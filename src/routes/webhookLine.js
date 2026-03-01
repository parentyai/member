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
const { appendAuditLog } = require('../usecases/audit/appendAuditLog');
const { getPublicWriteSafetySnapshot } = require('../repos/firestore/systemFlagsRepo');
const journeyGraphCatalogRepo = require('../repos/firestore/journeyGraphCatalogRepo');
const {
  detectExplicitPaidIntent,
  classifyPaidIntent,
  generatePaidAssistantReply
} = require('../usecases/assistant/generatePaidAssistantReply');
const { generatePaidFaqReply } = require('../usecases/assistant/generatePaidFaqReply');
const { handleJourneyLineCommand } = require('../usecases/journey/handleJourneyLineCommand');
const { handleJourneyPostback } = require('../usecases/journey/handleJourneyPostback');
const taskNodesRepo = require('../repos/firestore/taskNodesRepo');
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
const ROUTE_KEY = 'webhook_line';

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

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return defaultValue === true;
}

function resolvePaidFaqQualityEnabled() {
  return resolveBooleanEnvFlag('ENABLE_PAID_FAQ_QUALITY_V2', true);
}

function resolveSnapshotOnlyContextEnabled() {
  return resolveBooleanEnvFlag('ENABLE_SNAPSHOT_ONLY_CONTEXT_V1', false);
}

function resolveTaskGraphEnabled() {
  return resolveBooleanEnvFlag('ENABLE_TASK_GRAPH_V1', false);
}

function resolveProPredictiveActionsEnabled() {
  return resolveBooleanEnvFlag('ENABLE_PRO_PREDICTIVE_ACTIONS_V1', false);
}

function clampMaxNextActions(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(3, Math.floor(parsed)));
}

function resolvePlanTier(planInfo) {
  if (planInfo && planInfo.plan === 'pro') return 'pro';
  return 'free';
}

function resolveRefusalStrategy(policy) {
  const payload = policy && typeof policy === 'object' ? policy : {};
  const src = payload.refusal_strategy && typeof payload.refusal_strategy === 'object'
    ? payload.refusal_strategy
    : {};
  const modeRaw = typeof src.mode === 'string' ? src.mode.trim().toLowerCase() : '';
  const mode = modeRaw === 'faq_only' ? 'faq_only' : 'suggest_and_consult';
  const showBlockedReason = src.show_blocked_reason === true;
  const fallbackRaw = typeof src.fallback === 'string' ? src.fallback.trim().toLowerCase() : '';
  const fallback = fallbackRaw === 'free_retrieval' ? 'free_retrieval' : 'free_retrieval';
  return {
    mode,
    show_blocked_reason: showBlockedReason,
    fallback
  };
}

function buildRefusalExtraText(blockedReason, policy) {
  const strategy = resolveRefusalStrategy(policy);
  if (strategy.show_blocked_reason !== true) return '';
  const lines = [];
  if (strategy.show_blocked_reason && blockedReason) {
    lines.push(`回答を制限しました（理由: ${blockedReason}）`);
  }
  if (strategy.mode === 'suggest_and_consult') {
    lines.push('必要な場合は「相談希望」と送信してください。有人導線をご案内します。');
  }
  return lines.join('\n');
}

async function resolveMaxNextActionsCapFromJourneyCatalog(planInfo) {
  const planTier = resolvePlanTier(planInfo);
  try {
    const catalog = await journeyGraphCatalogRepo.getJourneyGraphCatalog();
    if (!catalog || catalog.enabled !== true) return null;
    const unlock = catalog.planUnlocks && typeof catalog.planUnlocks === 'object'
      ? catalog.planUnlocks[planTier]
      : null;
    if (!unlock || typeof unlock !== 'object') return null;
    return clampMaxNextActions(unlock.maxNextActions);
  } catch (_err) {
    return null;
  }
}

function isDependencyHintIntent(text) {
  const normalized = normalizeReplyText(text).toLowerCase();
  if (!normalized) return false;
  return /todo|依存|ロック|タスク|next action|次の行動/.test(normalized);
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.getTime();
  }
  return null;
}

async function loadTaskGraphSummary(lineUserId) {
  if (!resolveTaskGraphEnabled()) return null;
  if (!lineUserId || typeof lineUserId !== 'string') return null;
  try {
    const nodes = await taskNodesRepo.listTaskNodesByLineUserId({ lineUserId, limit: 200 });
    const actionable = nodes
      .filter((node) => node && node.status !== 'done' && node.graphStatus !== 'locked')
      .sort((a, b) => {
        const scoreA = Number(a && a.riskScore);
        const scoreB = Number(b && b.riskScore);
        if (Number.isFinite(scoreA) && Number.isFinite(scoreB) && scoreA !== scoreB) return scoreB - scoreA;
        const dueA = toMillis(a && a.dueAt);
        const dueB = toMillis(b && b.dueAt);
        if (Number.isFinite(dueA) && Number.isFinite(dueB) && dueA !== dueB) return dueA - dueB;
        return String(a && a.todoKey ? a.todoKey : '').localeCompare(String(b && b.todoKey ? b.todoKey : ''), 'ja');
      })
      .slice(0, 3);
    const locked = nodes.filter((node) => node && node.graphStatus === 'locked');
    return {
      total: nodes.length,
      lockedCount: locked.length,
      actionableTop3: actionable,
      lockedReasons: locked
        .flatMap((node) => (Array.isArray(node && node.lockReasons) ? node.lockReasons : []))
        .filter(Boolean)
        .slice(0, 3)
    };
  } catch (_err) {
    return null;
  }
}

function buildFreeDependencyHint(graphSummary) {
  const graph = graphSummary && typeof graphSummary === 'object' ? graphSummary : null;
  if (!graph || graph.lockedCount <= 0) return '';
  const lines = [`依存ロック中タスク: ${graph.lockedCount}件`];
  if (Array.isArray(graph.lockedReasons) && graph.lockedReasons.length) {
    lines.push(`ロック理由: ${graph.lockedReasons.join(' / ')}`);
  }
  return lines.join('\n');
}

function buildProDependencyAddendum(graphSummary) {
  const graph = graphSummary && typeof graphSummary === 'object' ? graphSummary : null;
  if (!graph) return '';
  const lines = ['補足（依存グラフ）'];
  lines.push(`ロック中: ${graph.lockedCount || 0}件`);
  if (Array.isArray(graph.lockedReasons) && graph.lockedReasons.length) {
    lines.push(`主要ロック理由: ${graph.lockedReasons.join(' / ')}`);
  }
  if (Array.isArray(graph.actionableTop3) && graph.actionableTop3.length) {
    lines.push('次アクション候補(最大3):');
    graph.actionableTop3.slice(0, 3).forEach((item, index) => {
      const key = item && item.todoKey ? item.todoKey : `task_${index + 1}`;
      const title = item && item.title ? item.title : key;
      const due = item && item.dueDate ? item.dueDate : '-';
      lines.push(`${index + 1}. ${title} [${key}] (期限:${due})`);
    });
  }
  return lines.join('\n');
}

async function appendLlmGateDecisionBestEffort(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const lineUserId = typeof payload.lineUserId === 'string' ? payload.lineUserId.trim() : '';
  if (!lineUserId) return;
  const policy = payload.policy && typeof payload.policy === 'object' ? payload.policy : null;
  const refusalStrategy = resolveRefusalStrategy(policy);
  const policyVersionId = payload.policyVersionId
    || (policy && typeof policy.policy_version_id === 'string' ? policy.policy_version_id : null)
    || null;
  try {
    await appendAuditLog({
      actor: 'line_webhook',
      action: 'llm_gate.decision',
      entityType: 'llm_gate',
      entityId: lineUserId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: {
        lineUserId,
        plan: payload.plan || 'free',
        status: payload.status || 'unknown',
        intent: payload.intent || 'faq_search',
        decision: payload.decision || 'blocked',
        blockedReason: payload.blockedReason || null,
        tokenUsed: Number.isFinite(Number(payload.tokenUsed)) ? Number(payload.tokenUsed) : 0,
        costEstimate: Number.isFinite(Number(payload.costEstimate)) ? Number(payload.costEstimate) : null,
        model: payload.model || null,
        policyVersionId,
        refusalMode: refusalStrategy.mode
      }
    });
  } catch (_err) {
    // best effort only
  }
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

async function appendWebhookBlockedAuditBestEffort(data) {
  const payload = data && typeof data === 'object' ? data : {};
  try {
    await appendAuditLog({
      actor: 'line_webhook',
      action: payload.action || 'line_webhook.blocked',
      entityType: 'line_webhook',
      entityId: 'line_webhook',
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: {
        reason: payload.reason || 'unknown',
        eventCount: Number.isFinite(Number(payload.eventCount)) ? Number(payload.eventCount) : 0,
        failCloseMode: payload.failCloseMode || null,
        guardRoute: ROUTE_KEY
      }
    });
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
  const refusalExtraText = normalizeReplyText(
    payload.refusalExtraText || buildRefusalExtraText(payload.blockedReason || null, payload.llmPolicy || null)
  );
  const mergedExtra = [normalizeReplyText(payload.extraText || ''), refusalExtraText]
    .filter(Boolean)
    .join('\n\n');
  const extra = normalizeReplyText(mergedExtra);
  const base = trimForLineMessage(retrieval.replyText) || '関連情報を取得できませんでした。';
  const replyText = extra ? trimForLineMessage(`${base}\n\n${extra}`) : base;
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
  const traceId = typeof payload.requestId === 'string' && payload.requestId.trim()
    ? payload.requestId.trim()
    : null;
  const requestId = traceId;

  if (planInfo.plan !== 'pro') {
    const blockedReason = explicitPaidIntent ? 'plan_free' : 'free_retrieval_only';
    const dependencyHint = isDependencyHintIntent(text)
      ? buildFreeDependencyHint(await loadTaskGraphSummary(lineUserId))
      : '';
    const fallback = await replyWithFreeRetrieval(Object.assign({}, payload, {
      extraText: dependencyHint,
      blockedReason
    }));
    if (explicitPaidIntent) {
      await appendJourneyEventBestEffort({
        lineUserId,
        type: 'pro_prompted',
        intent: explicitPaidIntent,
        summary: text.slice(0, 120),
        createdAt: new Date().toISOString()
      });
    }
    const usage = await recordLlmUsage({
      userId: lineUserId,
      plan: planInfo.plan,
      subscriptionStatus: planInfo.status,
      intent: 'faq_search',
      decision: 'blocked',
      blockedReason,
      tokensIn: 0,
      tokensOut: 0,
      tokenUsed: 0
    });
    await appendLlmGateDecisionBestEffort({
      lineUserId,
      plan: planInfo.plan,
      status: planInfo.status,
      intent: paidIntent,
      decision: 'blocked',
      blockedReason,
      tokenUsed: 0,
      costEstimate: usage && usage.costEstimate,
      traceId,
      requestId
    });
    return {
      handled: true,
      mode: 'free_retrieval',
      fallback,
      blockedReason
    };
  }

  const budget = await evaluateLLMBudget(lineUserId, {
    intent: paidIntent,
    tokenEstimate: 0,
    planInfo
  });

  if (!budget.allowed) {
    const blockedReason = budget.blockedReason || 'plan_gate_blocked';
    const fallback = await replyWithFreeRetrieval(Object.assign({}, payload, {
      blockedReason,
      llmPolicy: budget.policy || null
    }));
    const usage = await recordLlmUsage({
      userId: lineUserId,
      plan: planInfo.plan,
      subscriptionStatus: planInfo.status,
      intent: paidIntent,
      decision: 'blocked',
      blockedReason,
      tokensIn: 0,
      tokensOut: 0,
      tokenUsed: 0
    });
    await appendLlmGateDecisionBestEffort({
      lineUserId,
      plan: planInfo.plan,
      status: planInfo.status,
      intent: paidIntent,
      decision: 'blocked',
      blockedReason,
      tokenUsed: 0,
      costEstimate: usage && usage.costEstimate,
      model: budget.policy && budget.policy.model,
      policy: budget.policy || null,
      traceId,
      requestId
    });
    return {
      handled: true,
      mode: 'gate_blocked',
      fallback,
      blockedReason
    };
  }

  const availability = await evaluateLlmAvailability({ policy: budget.policy });
  if (!availability.available) {
    const blockedReason = availability.reason || 'llm_unavailable';
    const fallback = await replyWithFreeRetrieval(Object.assign({}, payload, {
      blockedReason,
      llmPolicy: budget.policy || null
    }));
    const usage = await recordLlmUsage({
      userId: lineUserId,
      plan: planInfo.plan,
      subscriptionStatus: planInfo.status,
      intent: paidIntent,
      decision: 'blocked',
      blockedReason,
      tokensIn: 0,
      tokensOut: 0,
      tokenUsed: 0,
      model: budget.policy && budget.policy.model
    });
    await appendLlmGateDecisionBestEffort({
      lineUserId,
      plan: planInfo.plan,
      status: planInfo.status,
      intent: paidIntent,
      decision: 'blocked',
      blockedReason,
      tokenUsed: 0,
      costEstimate: usage && usage.costEstimate,
      model: budget.policy && budget.policy.model,
      policy: budget.policy || null,
      traceId,
      requestId
    });
    return {
      handled: true,
      mode: 'llm_unavailable_fallback',
      fallback,
      blockedReason
    };
  }

  const snapshotStrictMode = resolveSnapshotOnlyContextEnabled();
  const snapshotResult = await getUserContextSnapshot({
    lineUserId,
    maxAgeHours: 24 * 14
  }).catch(() => ({ ok: false, reason: 'snapshot_unavailable' }));
  if (snapshotStrictMode && (!snapshotResult || snapshotResult.ok !== true || snapshotResult.stale === true)) {
    const blockedReason = snapshotResult && snapshotResult.ok === true && snapshotResult.stale === true
      ? 'snapshot_stale'
      : 'snapshot_unavailable';
    const fallback = await replyWithFreeRetrieval(Object.assign({}, payload, {
      blockedReason,
      llmPolicy: budget.policy || null
    }));
    const usage = await recordLlmUsage({
      userId: lineUserId,
      plan: planInfo.plan,
      subscriptionStatus: planInfo.status,
      intent: paidIntent,
      decision: 'blocked',
      blockedReason,
      tokensIn: 0,
      tokensOut: 0,
      tokenUsed: 0,
      model: budget.policy && budget.policy.model
    });
    await appendLlmGateDecisionBestEffort({
      lineUserId,
      plan: planInfo.plan,
      status: planInfo.status,
      intent: paidIntent,
      decision: 'blocked',
      blockedReason,
      tokenUsed: 0,
      costEstimate: usage && usage.costEstimate,
      model: budget.policy && budget.policy.model,
      policy: budget.policy || null,
      traceId,
      requestId
    });
    return {
      handled: true,
      mode: 'snapshot_blocked_fallback',
      fallback,
      blockedReason
    };
  }

  const qualityEnabled = resolvePaidFaqQualityEnabled();
  const contextSnapshot = snapshotResult && snapshotResult.ok === true && snapshotResult.stale !== true
    ? snapshotResult.snapshot
    : null;
  const maxNextActionsCap = await resolveMaxNextActionsCapFromJourneyCatalog(planInfo);
  const paid = qualityEnabled
    ? await generatePaidFaqReply({
      lineUserId,
      question: text,
      intent: paidIntent,
      locale: 'ja',
      llmAdapter: llmClient,
      llmPolicy: budget.policy,
      contextSnapshot,
      maxNextActionsCap,
      skipPersonalizedContext: snapshotStrictMode === true
    })
    : await generatePaidAssistantReply({
      question: text,
      intent: paidIntent,
      locale: 'ja',
      llmAdapter: llmClient,
      llmPolicy: budget.policy,
      contextSnapshot,
      maxNextActionsCap
    });

  if (!paid.ok) {
    const blockedReason = paid.blockedReason || 'llm_error';
    const fallback = await replyWithFreeRetrieval(Object.assign({}, payload, {
      blockedReason,
      llmPolicy: budget.policy || null
    }));
    const usage = await recordLlmUsage({
      userId: lineUserId,
      plan: planInfo.plan,
      subscriptionStatus: planInfo.status,
      intent: paidIntent,
      decision: 'blocked',
      blockedReason,
      tokensIn: 0,
      tokensOut: 0,
      tokenUsed: 0,
      model: budget.policy && budget.policy.model
    });
    await appendLlmGateDecisionBestEffort({
      lineUserId,
      plan: planInfo.plan,
      status: planInfo.status,
      intent: paidIntent,
      decision: 'blocked',
      blockedReason,
      tokenUsed: 0,
      costEstimate: usage && usage.costEstimate,
      model: budget.policy && budget.policy.model,
      policy: budget.policy || null,
      traceId,
      requestId
    });
    return {
      handled: true,
      mode: 'fallback',
      fallback,
      blockedReason
    };
  }

  let replyText = trimForLineMessage(paid.replyText) || '回答の整形に失敗しました。';
  if (resolveProPredictiveActionsEnabled()) {
    const addendum = buildProDependencyAddendum(await loadTaskGraphSummary(lineUserId));
    if (addendum) replyText = trimForLineMessage(`${replyText}\n\n${addendum}`);
  }
  await payload.replyFn(payload.replyToken, { type: 'text', text: replyText });

  const tokenUsed = (paid.tokensIn || 0) + (paid.tokensOut || 0);
  const usage = await recordLlmUsage({
    userId: lineUserId,
    plan: planInfo.plan,
    subscriptionStatus: planInfo.status,
    intent: paidIntent,
    decision: 'allow',
    blockedReason: null,
    tokensIn: paid.tokensIn || 0,
    tokensOut: paid.tokensOut || 0,
    tokenUsed,
    model: paid.model || (budget.policy && budget.policy.model)
  });
  await appendLlmGateDecisionBestEffort({
    lineUserId,
    plan: planInfo.plan,
    status: planInfo.status,
    intent: paidIntent,
    decision: 'allow',
    blockedReason: null,
    tokenUsed,
    costEstimate: usage && usage.costEstimate,
    model: paid.model || (budget.policy && budget.policy.model),
    policy: budget.policy || null,
    traceId,
    requestId
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
  const optionRequestId = options && typeof options.requestId === 'string' ? options.requestId.trim() : '';
  const optionTraceId = options && typeof options.traceId === 'string' ? options.traceId.trim() : '';
  const requestId = optionRequestId || `line_webhook_${crypto.randomUUID()}`;
  const traceId = optionTraceId || requestId;
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

  const customKillSwitchFn = options && typeof options.getKillSwitchFn === 'function'
    ? options.getKillSwitchFn
    : null;
  let safety = null;
  if (customKillSwitchFn) {
    try {
      const killSwitchOn = await customKillSwitchFn();
      safety = {
        killSwitchOn: Boolean(killSwitchOn),
        failCloseMode: 'warn',
        readError: false
      };
    } catch (err) {
      const fallback = await getPublicWriteSafetySnapshot(ROUTE_KEY);
      safety = Object.assign({}, fallback, {
        killSwitchOn: false,
        readError: true,
        readErrorCode: 'kill_switch_read_failed',
        readErrorMessage: err && err.message ? String(err.message) : 'kill switch read failed'
      });
    }
  } else {
    safety = await getPublicWriteSafetySnapshot(ROUTE_KEY);
  }
  if (safety && safety.readError) {
    if (safety.failCloseMode === 'enforce') {
      await appendWebhookBlockedAuditBestEffort({
        action: 'line_webhook.blocked',
        traceId,
        requestId,
        reason: 'kill_switch_read_failed_fail_closed',
        failCloseMode: safety.failCloseMode,
        eventCount: Array.isArray(payload && payload.events) ? payload.events.length : 0
      });
      logger(`[webhook] requestId=${requestId} reject=kill_switch_read_failed_fail_closed`);
      return { status: 503, body: 'temporarily unavailable' };
    }
    if (safety.failCloseMode === 'warn') {
      await appendWebhookBlockedAuditBestEffort({
        action: 'line_webhook.guard_warn',
        traceId,
        requestId,
        reason: 'kill_switch_read_failed_fail_open',
        failCloseMode: safety.failCloseMode,
        eventCount: Array.isArray(payload && payload.events) ? payload.events.length : 0
      });
    }
  }
  if (safety && safety.killSwitchOn) {
    await appendWebhookBlockedAuditBestEffort({
      traceId,
      requestId,
      reason: 'kill_switch_on',
      eventCount: Array.isArray(payload && payload.events) ? payload.events.length : 0
    });
    logger(`[webhook] requestId=${requestId} reject=kill_switch_on`);
    return { status: 409, body: 'kill switch on' };
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
