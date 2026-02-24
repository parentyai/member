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
const { searchFaqFromKb } = require('../usecases/faq/searchFaqFromKb');
const {
  classifyPaidIntent,
  generatePaidAssistantReply
} = require('../usecases/assistant/generatePaidAssistantReply');
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

function trimForLineMessage(value) {
  const text = normalizeReplyText(value);
  if (!text) return '';
  return text.length > 4500 ? `${text.slice(0, 4500)}...` : text;
}

async function replyWithFaqFallback(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const faq = await searchFaqFromKb({
    question: payload.text,
    locale: 'ja',
    limit: 3
  });
  const replyText = trimForLineMessage(faq.replyText) || 'FAQ候補を取得できませんでした。';
  await payload.replyFn(payload.replyToken, { type: 'text', text: replyText });
  return faq;
}

async function handleAssistantMessage(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = payload.lineUserId;
  const text = normalizeReplyText(payload.text);
  if (!lineUserId || !text || !payload.replyToken || typeof payload.replyFn !== 'function') {
    return { handled: false };
  }

  const planInfo = await resolvePlan(lineUserId);
  const intent = classifyPaidIntent(text);
  const budget = await evaluateLLMBudget(lineUserId, {
    intent,
    tokenEstimate: 0,
    planInfo
  });

  if (!budget.allowed || planInfo.plan !== 'pro') {
    const fallback = await replyWithFaqFallback(payload);
    await recordLlmUsage({
      userId: lineUserId,
      plan: planInfo.plan,
      subscriptionStatus: planInfo.status,
      intent,
      decision: 'blocked',
      blockedReason: budget.blockedReason || 'plan_free',
      tokensIn: 0,
      tokensOut: 0,
      tokenUsed: 0
    });
    return {
      handled: true,
      mode: 'free',
      fallback,
      blockedReason: budget.blockedReason || 'plan_free'
    };
  }

  const paid = await generatePaidAssistantReply({
    question: text,
    intent,
    locale: 'ja',
    llmAdapter: llmClient,
    llmPolicy: budget.policy
  });

  if (!paid.ok) {
    const fallback = await replyWithFaqFallback(payload);
    await recordLlmUsage({
      userId: lineUserId,
      plan: planInfo.plan,
      subscriptionStatus: planInfo.status,
      intent,
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
    intent,
    decision: 'allow',
    blockedReason: null,
    tokensIn: paid.tokensIn || 0,
    tokensOut: paid.tokensOut || 0,
    tokenUsed: (paid.tokensIn || 0) + (paid.tokensOut || 0),
    model: paid.model || (budget.policy && budget.policy.model)
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

    // Membership declare command: "会員ID NN-NNNN"
    if (event && event.type === 'message') {
      const text = extractMessageText(event);
      const replyToken = extractReplyToken(event);
      if (text && replyToken) {
        try {
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
