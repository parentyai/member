'use strict';

const crypto = require('crypto');
const { ensureUserFromWebhook } = require('../usecases/users/ensureUser');
const { sendWelcomeMessage } = require('../usecases/notifications/sendWelcomeMessage');
const { logLineWebhookEventsBestEffort } = require('../usecases/line/logLineWebhookEvents');
const { declareRedacMembershipIdFromLine } = require('../usecases/users/declareRedacMembershipIdFromLine');
const { getRedacMembershipStatusForLine } = require('../usecases/users/getRedacMembershipStatusForLine');
const { replyMessage } = require('../infra/lineClient');
const { declareCityRegionFromLine } = require('../usecases/cityPack/declareCityRegionFromLine');
const { declareCityPackFeedbackFromLine } = require('../usecases/cityPack/declareCityPackFeedbackFromLine');
const { recordUserLlmConsent } = require('../usecases/llm/recordUserLlmConsent');
const llmClient = require('../infra/llmClient');
const { resolvePlan } = require('../usecases/billing/planGate');
const { evaluateLLMBudget } = require('../usecases/billing/evaluateLlmBudget');
const { recordLlmUsage } = require('../usecases/assistant/recordLlmUsage');
const { evaluateLlmAvailability } = require('../usecases/assistant/llmAvailabilityGate');
const { getUserContextSnapshot } = require('../usecases/context/getUserContextSnapshot');
const { generateFreeRetrievalReply } = require('../usecases/assistant/generateFreeRetrievalReply');
const { createEvent } = require('../repos/firestore/eventsRepo');
const {
  detectExplicitPaidIntent,
  classifyPaidIntent,
  generatePaidAssistantReply
} = require('../usecases/assistant/generatePaidAssistantReply');
const { generatePaidFaqReply } = require('../usecases/assistant/generatePaidFaqReply');
const { handleJourneyLineCommand } = require('../usecases/journey/handleJourneyLineCommand');
const { handleJourneyPostback } = require('../usecases/journey/handleJourneyPostback');
const {
  regionPrompt,
  regionDeclared,
  regionInvalid,
  regionAlreadySet
} = require('../domain/regionLineMessages');
const {
  feedbackReceived,
  feedbackUsage
} = require('../domain/cityPackFeedbackMessages');
const {
  statusDeclared,
  statusUnlinked,
  statusNotDeclared,
  declareLinked,
  declareDuplicate,
  declareInvalidFormat,
  declareUsage,
  declareServerMisconfigured
} = require('../domain/redacLineMessages');

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyLineSignature(secret, body, signature) {
  if (!secret || !signature) return false;
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('base64');
  const actual = Buffer.from(signature);
  const expected = Buffer.from(hmac);
  return timingSafeEqual(actual, expected);
}

function extractUserIds(payload) {
  const events = Array.isArray(payload && payload.events) ? payload.events : [];
  const ids = new Set();
  for (const event of events) {
    const userId = event && event.source && event.source.userId;
    if (typeof userId === 'string' && userId.length > 0) {
      ids.add(userId);
    }
  }
  return Array.from(ids);
}

function extractLineUserId(event) {
  const userId = event && event.source && event.source.userId;
  return typeof userId === 'string' && userId.length > 0 ? userId : null;
}

function extractReplyToken(event) {
  const t = event && event.replyToken;
  return typeof t === 'string' && t.length > 0 ? t : null;
}

function extractMessageText(event) {
  const msg = event && event.message && typeof event.message === 'object' ? event.message : null;
  if (!msg || msg.type !== 'text') return null;
  const text = msg.text;
  return typeof text === 'string' ? text : null;
}

function isRedacStatusCommand(text) {
  const raw = typeof text === 'string' ? text : '';
  if (!raw) return false;
  return /^\s*会員\s*[IiＩｉ][DdＤｄ]\s*確認\s*$/.test(raw);
}

function isLlmConsentAcceptCommand(text) {
  const raw = typeof text === 'string' ? text.trim() : '';
  return raw === 'AI同意' || raw === 'LLM同意';
}

function isLlmConsentRevokeCommand(text) {
  const raw = typeof text === 'string' ? text.trim() : '';
  return raw === 'AI拒否' || raw === 'LLM拒否';
}

function normalizeReplyText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function parseJourneyPhaseCommand(text) {
  const raw = normalizeReplyText(text).toLowerCase();
  if (!raw) return null;
  const match = raw.match(/^(?:phase|フェーズ)\s*[:：]?\s*(pre|arrival|settled|extend|return)$/i);
  if (!match) return null;
  return match[1].toLowerCase();
}

function parseNextActionCompletedCommand(text) {
  const raw = normalizeReplyText(text);
  if (!raw) return null;
  const match = raw.match(/^(?:done|完了)\s*[:：]?\s*(.+)$/i);
  if (!match) return null;
  const key = normalizeReplyText(match[1]).toLowerCase().replace(/\s+/g, '_');
  return key || null;
}

function trimForLineMessage(value) {
  const text = normalizeReplyText(value);
  if (!text) return '';
  return text.length > 4500 ? `${text.slice(0, 4500)}...` : text;
}

async function appendJourneyEventBestEffort(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const lineUserId = typeof payload.lineUserId === 'string' ? payload.lineUserId.trim() : '';
  const type = typeof payload.type === 'string' ? payload.type.trim() : '';
  if (!lineUserId || !type) return;
  try {
    await createEvent(Object.assign({}, payload, {
      lineUserId,
      type,
      createdAt: payload.createdAt || new Date().toISOString()
    }));
  } catch (_err) {
    // best effort only
  }
}

async function replyWithFreeRetrieval(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const retrieval = await generateFreeRetrievalReply({
    lineUserId: payload.lineUserId,
    question: payload.text,
    locale: 'ja'
  });
  const replyText = trimForLineMessage(retrieval.replyText) || '関連情報を取得できませんでした。';
  await payload.replyFn(payload.replyToken, { type: 'text', text: replyText });
  return retrieval;
}

async function handleAssistantMessage(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = payload.lineUserId;
  const text = normalizeReplyText(payload.text);
  if (!lineUserId || !text || !payload.replyToken || typeof payload.replyFn !== 'function') {
    return { handled: false };
  }

  const planInfo = await resolvePlan(lineUserId);
  const explicitPaidIntent = detectExplicitPaidIntent(text);
  const paidIntent = classifyPaidIntent(text);

  if (planInfo.plan !== 'pro') {
    const fallback = await replyWithFreeRetrieval(payload);
    if (explicitPaidIntent) {
      await appendJourneyEventBestEffort({
        lineUserId,
        type: 'pro_prompted',
        intent: explicitPaidIntent,
        summary: text.slice(0, 120),
        createdAt: new Date().toISOString()
      });
    }
    await recordLlmUsage({
      userId: lineUserId,
      plan: planInfo.plan,
      subscriptionStatus: planInfo.status,
      intent: 'faq_search',
      decision: 'blocked',
      blockedReason: explicitPaidIntent ? 'plan_free' : 'free_retrieval_only',
      tokensIn: 0,
      tokensOut: 0,
      tokenUsed: 0
    });
    return {
      handled: true,
      mode: 'free_retrieval',
      fallback,
      blockedReason: explicitPaidIntent ? 'plan_free' : 'free_retrieval_only'
    };
  }

  const budget = await evaluateLLMBudget(lineUserId, {
    intent: paidIntent,
    tokenEstimate: 0,
    planInfo
  });

  if (!budget.allowed) {
    const fallback = await replyWithFreeRetrieval(payload);
    await recordLlmUsage({
      userId: lineUserId,
      plan: planInfo.plan,
      subscriptionStatus: planInfo.status,
      intent: paidIntent,
      decision: 'blocked',
      blockedReason: budget.blockedReason || 'plan_gate_blocked',
      tokensIn: 0,
      tokensOut: 0,
      tokenUsed: 0
    });
    return {
      handled: true,
      mode: 'gate_blocked',
      fallback,
      blockedReason: budget.blockedReason || 'plan_gate_blocked'
    };
  }

  const availability = await evaluateLlmAvailability({ policy: budget.policy });
  if (!availability.available) {
    const fallback = await replyWithFreeRetrieval(payload);
    await recordLlmUsage({
      userId: lineUserId,
      plan: planInfo.plan,
      subscriptionStatus: planInfo.status,
      intent: paidIntent,
      decision: 'blocked',
      blockedReason: availability.reason || 'llm_unavailable',
      tokensIn: 0,
      tokensOut: 0,
      tokenUsed: 0,
      model: budget.policy && budget.policy.model
    });
    return {
      handled: true,
      mode: 'llm_unavailable_fallback',
      fallback,
      blockedReason: availability.reason || 'llm_unavailable'
    };
  }

  const snapshotResult = await getUserContextSnapshot({
    lineUserId,
    maxAgeHours: 24 * 14
  }).catch(() => ({ ok: false, reason: 'snapshot_unavailable' }));

  const paid = await generatePaidAssistantReply({
    question: text,
    intent: paidIntent,
    locale: 'ja',
    llmAdapter: llmClient,
    llmPolicy: budget.policy,
    contextSnapshot: snapshotResult && snapshotResult.ok ? snapshotResult.snapshot : null
  });

  if (!paid.ok) {
    const fallback = await replyWithFreeRetrieval(payload);
    await recordLlmUsage({
      userId: lineUserId,
      plan: planInfo.plan,
      subscriptionStatus: planInfo.status,
      intent: paidIntent,
      decision: 'blocked',
      blockedReason: paid.blockedReason || 'llm_error',
      tokensIn: 0,
      tokensOut: 0,
      tokenUsed: 0,
      model: budget.policy && budget.policy.model
    });
    return {
      handled: true,
      mode: 'fallback',
      fallback,
      blockedReason: paid.blockedReason || 'llm_error'
    };
  }

  const replyText = trimForLineMessage(paid.replyText) || '回答の整形に失敗しました。';
  await payload.replyFn(payload.replyToken, { type: 'text', text: replyText });

  await recordLlmUsage({
    userId: lineUserId,
    plan: planInfo.plan,
    subscriptionStatus: planInfo.status,
    intent: paidIntent,
    decision: 'allow',
    blockedReason: null,
    tokensIn: paid.tokensIn || 0,
    tokensOut: paid.tokensOut || 0,
    tokenUsed: (paid.tokensIn || 0) + (paid.tokensOut || 0),
    model: paid.model || (budget.policy && budget.policy.model)
  });

  await appendJourneyEventBestEffort({
    lineUserId,
    type: 'next_action_shown',
    intent: paidIntent,
    phase: snapshotResult && snapshotResult.ok && snapshotResult.snapshot ? snapshotResult.snapshot.phase : null,
    nextActions: paid && paid.output ? paid.output.nextActions : [],
    evidenceKeys: paid && paid.output ? paid.output.evidenceKeys : [],
    summary: paid && paid.output ? paid.output.situation : null,
    createdAt: new Date().toISOString()
  });

  return {
    handled: true,
    mode: 'paid',
    blockedReason: null
  };
}

async function handleLineWebhook(options) {
  const secret = process.env.LINE_CHANNEL_SECRET || '';
  const signature = options && options.signature;
  const body = options && options.body;
  const logger = (options && options.logger) || (() => {});
  const requestId = (options && options.requestId) || 'unknown';
  const isWebhookEdge = process.env.SERVICE_MODE === 'webhook';
  const allowWelcome = Boolean(options && options.allowWelcome === true);

  if (!secret) {
    logger(`[webhook] requestId=${requestId} reject=missing-secret`);
    return { status: 500, body: 'server misconfigured' };
  }
  if (typeof signature !== 'string' || signature.length === 0) {
    logger(`[webhook] requestId=${requestId} reject=missing-signature`);
    return { status: 401, body: 'unauthorized' };
  }
  if (!verifyLineSignature(secret, body, signature)) {
    logger(`[webhook] requestId=${requestId} reject=invalid-signature`);
    return { status: 401, body: 'unauthorized' };
  }

  let payload;
  try {
    payload = JSON.parse(body || '{}');
  } catch (err) {
    logger(`[webhook] requestId=${requestId} reject=invalid-json`);
    return { status: 400, body: 'invalid json' };
  }

  await logLineWebhookEventsBestEffort({ payload, requestId });

  const userIds = extractUserIds(payload);
  const firstUserId = userIds[0] || '';
  const welcomeFn = (options && options.sendWelcomeFn) || sendWelcomeMessage;
  const replyFn = (options && options.replyFn) || replyMessage;

  // Ensure users and run interactive commands (best-effort).
  const events = Array.isArray(payload && payload.events) ? payload.events : [];
  const ensured = new Set();
  for (const event of events) {
    const userId = extractLineUserId(event);
    if (!userId) continue;
    if (!ensured.has(userId)) {
      await ensureUserFromWebhook(userId);
      ensured.add(userId);
      if (!isWebhookEdge || allowWelcome) {
        await welcomeFn({ lineUserId: userId, pushFn: options && options.pushFn });
      }
    }

    if (event && event.type === 'postback') {
      const replyToken = extractReplyToken(event);
      const postbackData = event && event.postback && typeof event.postback.data === 'string'
        ? event.postback.data
        : '';
      if (replyToken && postbackData) {
        try {
          const journey = await handleJourneyPostback({
            lineUserId: userId,
            data: postbackData
          });
          if (journey && journey.handled) {
            await replyFn(replyToken, {
              type: 'text',
              text: normalizeReplyText(journey.replyText) || '設定を更新しました。'
            });
            continue;
          }
        } catch (err) {
          const msg = err && err.message ? err.message : 'error';
          logger(`[webhook] requestId=${requestId} journey_postback=error message=${msg}`);
        }
      }
    }

    // Membership declare command: "会員ID NN-NNNN"
    if (event && event.type === 'message') {
      const text = extractMessageText(event);
      const replyToken = extractReplyToken(event);
      if (text && replyToken) {
        try {
          const journey = await handleJourneyLineCommand({ lineUserId: userId, text });
          if (journey && journey.handled) {
            await replyFn(replyToken, {
              type: 'text',
              text: normalizeReplyText(journey.replyText) || '設定を更新しました。'
            });
            continue;
          }

          if (isLlmConsentAcceptCommand(text)) {
            await recordUserLlmConsent({ lineUserId: userId, accepted: true, traceId: requestId, actor: userId });
            await replyFn(replyToken, { type: 'text', text: 'AI機能の利用に同意しました。' });
            continue;
          }
          if (isLlmConsentRevokeCommand(text)) {
            await recordUserLlmConsent({ lineUserId: userId, accepted: false, traceId: requestId, actor: userId });
            await replyFn(replyToken, { type: 'text', text: 'AI機能の利用への同意を取り消しました。' });
            continue;
          }

          if (isRedacStatusCommand(text)) {
            const status = await getRedacMembershipStatusForLine({ lineUserId: userId, requestId });
            if (status.status === 'DECLARED' && status.last4) {
              await replyFn(replyToken, {
                type: 'text',
                text: statusDeclared(status.last4)
              });
            } else if (status.status === 'UNLINKED') {
              await replyFn(replyToken, {
                type: 'text',
                text: statusUnlinked()
              });
            } else {
              await replyFn(replyToken, {
                type: 'text',
                text: statusNotDeclared()
              });
            }
            continue;
          }

          const result = await declareRedacMembershipIdFromLine({ lineUserId: userId, text, requestId });
          if (result.status === 'linked') {
            await replyFn(replyToken, {
              type: 'text',
              text: declareLinked()
            });
            continue;
          } else if (result.status === 'duplicate') {
            await replyFn(replyToken, {
              type: 'text',
              text: declareDuplicate()
            });
            continue;
          } else if (result.status === 'invalid_format') {
            await replyFn(replyToken, { type: 'text', text: declareInvalidFormat() });
            continue;
          } else if (result.status === 'usage') {
            await replyFn(replyToken, { type: 'text', text: declareUsage() });
            continue;
          } else if (result.status === 'server_misconfigured') {
            await replyFn(replyToken, { type: 'text', text: declareServerMisconfigured() });
            continue;
          }

          const feedback = await declareCityPackFeedbackFromLine({ lineUserId: userId, text, requestId, traceId: requestId });
          if (feedback.status === 'received') {
            await replyFn(replyToken, { type: 'text', text: feedbackReceived() });
            continue;
          }
          if (feedback.status === 'usage') {
            await replyFn(replyToken, { type: 'text', text: feedbackUsage() });
            continue;
          }

          const region = await declareCityRegionFromLine({ lineUserId: userId, text, requestId, traceId: requestId });
          if (region.status === 'declared') {
            await replyFn(replyToken, { type: 'text', text: regionDeclared(region.regionCity, region.regionState) });
            continue;
          }
          if (region.status === 'prompt_required') {
            const message = region.reason === 'invalid_format' ? regionInvalid() : regionPrompt();
            await replyFn(replyToken, { type: 'text', text: message });
            continue;
          }
          if (region.status === 'already_set') {
            if (/地域|city|state|region/i.test(text)) {
              await replyFn(replyToken, { type: 'text', text: regionAlreadySet() });
              continue;
            }
          }

          const phaseCommand = parseJourneyPhaseCommand(text);
          if (phaseCommand) {
            await appendJourneyEventBestEffort({
              lineUserId: userId,
              type: 'user_phase_changed',
              toPhase: phaseCommand,
              summary: text.slice(0, 120),
              createdAt: new Date().toISOString()
            });
            await replyFn(replyToken, { type: 'text', text: `フェーズ更新を記録しました: ${phaseCommand}` });
            continue;
          }

          const doneKey = parseNextActionCompletedCommand(text);
          if (doneKey) {
            await appendJourneyEventBestEffort({
              lineUserId: userId,
              type: 'next_action_completed',
              nextActions: [{ key: doneKey, status: 'done' }],
              summary: text.slice(0, 120),
              createdAt: new Date().toISOString()
            });
            await replyFn(replyToken, { type: 'text', text: `完了を記録しました: ${doneKey}` });
            continue;
          }

          const assistant = await handleAssistantMessage({
            lineUserId: userId,
            text,
            replyToken,
            replyFn,
            requestId
          });
          if (assistant && assistant.handled) {
            const mode = assistant.mode || 'unknown';
            const blockedReason = assistant.blockedReason || '-';
            logger(`[webhook] requestId=${requestId} llm_assistant mode=${mode} blockedReason=${blockedReason} lineUserId=${userId}`);
            continue;
          }
        } catch (err) {
          const msg = err && err.message ? err.message : 'error';
          logger(`[webhook] requestId=${requestId} redac_membership=error message=${msg}`);
        }
      }
    }
  }

  logger(`[webhook] requestId=${requestId} accept`);
  return { status: 200, body: 'ok', userCount: userIds.length, firstUserId };
}

module.exports = {
  handleLineWebhook,
  verifyLineSignature,
  extractUserIds
};
