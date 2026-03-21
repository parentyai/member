'use strict';

const crypto = require('crypto');
const { ensureUserFromWebhook } = require('../usecases/users/ensureUser');
const { sendWelcomeMessage } = require('../usecases/notifications/sendWelcomeMessage');
const { logLineWebhookEventsBestEffort } = require('../usecases/line/logLineWebhookEvents');
const { declareRedacMembershipIdFromLine } = require('../usecases/users/declareRedacMembershipIdFromLine');
const { getRedacMembershipStatusForLine } = require('../usecases/users/getRedacMembershipStatusForLine');
const { replyMessage, pushMessage } = require('../infra/lineClient');
const { declareCityRegionFromLine } = require('../usecases/cityPack/declareCityRegionFromLine');
const { syncCityPackRecommendedTasks } = require('../usecases/cityPack/syncCityPackRecommendedTasks');
const { declareCityPackFeedbackFromLine } = require('../usecases/cityPack/declareCityPackFeedbackFromLine');
const { recordUserLlmConsent } = require('../usecases/llm/recordUserLlmConsent');
const llmClient = require('../infra/llmClient');
const { resolvePlan } = require('../usecases/billing/planGate');
const { evaluateLLMBudget } = require('../usecases/billing/evaluateLlmBudget');
const { recordLlmUsage } = require('../usecases/assistant/recordLlmUsage');
const { evaluateLlmAvailability } = require('../usecases/assistant/llmAvailabilityGate');
const { getUserContextSnapshot } = require('../usecases/context/getUserContextSnapshot');
const { generateFreeRetrievalReply } = require('../usecases/assistant/generateFreeRetrievalReply');
const { composeConciergeReply, buildConciergeContextSnapshot } = require('../usecases/assistant/concierge/composeConciergeReply');
const { generatePaidCasualReply } = require('../usecases/assistant/generatePaidCasualReply');
const { detectOpportunity } = require('../usecases/assistant/opportunity/detectOpportunity');
const { detectMessagePosture } = require('../usecases/assistant/opportunity/detectMessagePosture');
const { loadRecentInterventionSignals } = require('../usecases/assistant/opportunity/loadRecentInterventionSignals');
const { routeConversation } = require('../domain/llm/router/conversationRouter');
const { normalizeConversationIntent } = require('../domain/llm/router/normalizeConversationIntent');
const { resolveRouteCoverageMeta } = require('../domain/llm/router/resolveRouteCoverageMeta');
const {
  resolveLlmLegalPolicySnapshot,
  loadLlmLegalPolicySnapshot
} = require('../domain/llm/policy/resolveLlmLegalPolicySnapshot');
const { resolveIntentRiskTier } = require('../domain/llm/policy/resolveIntentRiskTier');
const { runAnswerReadinessGateV2 } = require('../domain/llm/quality/runAnswerReadinessGateV2');
const { applyAnswerReadinessDecision } = require('../domain/llm/quality/applyAnswerReadinessDecision');
const { resolveJourneyActionSignals } = require('../domain/llm/quality/resolveJourneyActionSignals');
const { resolveRuntimeCityPackSignals } = require('../domain/llm/quality/resolveRuntimeCityPackSignals');
const { resolveRuntimeEmergencySignals } = require('../domain/llm/quality/resolveRuntimeEmergencySignals');
const { resolveTelemetryCoverageSignals } = require('../domain/llm/quality/resolveTelemetryCoverageSignals');
const { generatePaidDomainConciergeReply, FORBIDDEN_REPLY_PATTERN } = require('../usecases/assistant/generatePaidDomainConciergeReply');
const { generatePaidHousingConciergeReply } = require('../usecases/assistant/generatePaidHousingConciergeReply');
const { runPaidConversationOrchestrator } = require('../domain/llm/orchestrator/runPaidConversationOrchestrator');
const {
  upsertRecentTurn,
  listRecentTurns
} = require('../domain/llm/orchestrator/recentTurnCache');
const { createEvent } = require('../repos/firestore/eventsRepo');
const { appendAuditLog } = require('../usecases/audit/appendAuditLog');
const { appendLlmGateDecision } = require('../usecases/llm/appendLlmGateDecision');
const { appendConversationReviewSnapshot } = require('../usecases/qualityPatrol/appendConversationReviewSnapshot');
const {
  DEFAULT_PUBLIC_WRITE_FAIL_CLOSE_MODE,
  getPublicWriteSafetySnapshot,
  getLlmPolicy,
  getLlmConciergeEnabled,
  getLlmWebSearchEnabled,
  getLlmStyleEngineEnabled,
  getLlmBanditEnabled
} = require('../repos/firestore/systemFlagsRepo');
const { buildOutcome } = require('../domain/routeOutcomeContract');
const llmActionLogsRepo = require('../repos/firestore/llmActionLogsRepo');
const llmBanditStateRepo = require('../repos/firestore/llmBanditStateRepo');
const llmContextualBanditStateRepo = require('../repos/firestore/llmContextualBanditStateRepo');
const faqArticlesRepo = require('../repos/firestore/faqArticlesRepo');
const linkRegistryRepo = require('../repos/firestore/linkRegistryRepo');
const sourceRefsRepo = require('../repos/firestore/sourceRefsRepo');
const cityPacksRepo = require('../repos/firestore/cityPacksRepo');
const journeyGraphCatalogRepo = require('../repos/firestore/journeyGraphCatalogRepo');
const {
  detectExplicitPaidIntent,
  classifyPaidIntent,
  generatePaidAssistantReply
} = require('../usecases/assistant/generatePaidAssistantReply');
const { generatePaidFaqReply } = require('../usecases/assistant/generatePaidFaqReply');
const { selectConversationStyle } = require('../domain/llm/conversation/styleRouter');
const { composeConversationDraftFromSignals } = require('../domain/llm/conversation/conversationComposer');
const { humanizeConversationMessage } = require('../domain/llm/conversation/styleHumanizer');
const { sanitizePaidMainReply, containsLegacyTemplateTerms } = require('../domain/llm/conversation/paidReplyGuard');
const {
  buildReplyTemplateFingerprint,
  classifyReplyTemplateKind,
  resolveGenericFallbackSlice
} = require('../domain/llm/conversation/replyTemplateTelemetry');
const { resolveFreeContextualFollowup } = require('../domain/llm/conversation/freeContextualFollowup');
const { searchCityPackCandidates } = require('../usecases/assistant/retrieval/searchCityPackCandidates');
const { handleJourneyLineCommand } = require('../usecases/journey/handleJourneyLineCommand');
const { handleJourneyPostback } = require('../usecases/journey/handleJourneyPostback');
const { evaluateResponseContractConformance } = require('../v1/semantic/responseContractConformance');
const { InMemoryWebhookDedupeStore } = require('../v1/channel_edge/line/dedupeStore');
const { filterWebhookEventsAsync } = require('../v1/channel_edge/line/receiver');
const { classifyDispatchMode } = require('../v1/channel_edge/line/dispatcher');
const { buildServiceAckMessage } = require('../v1/line_renderer/fallbackRenderer');
const { buildSemanticLineMessage } = require('../v1/line_renderer/semanticLineMessage');
const { resolveLineSurfacePlan } = require('../v1/line_surface_policy/lineInteractionPolicy');
const { resolveGroupPrivacyPolicy } = require('../v1/policy_graph/groupPrivacyGate');
const taskNodesRepo = require('../repos/firestore/taskNodesRepo');
const {
  regionPrompt,
  regionDeclared,
  regionInvalid,
  regionAlreadySet
} = require('../domain/regionLineMessages');
const { parseRegionInput } = require('../domain/regionNormalization');
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
const PAID_CONCIERGE_DOMAIN_INTENTS = new Set(['housing', 'school', 'ssn', 'banking']);
const { FirestoreWebhookEdgeStateStore } = require('../v1/channel_edge/line/firestoreEdgeStateStore');
const WEBHOOK_DEDUPE_STORE = new InMemoryWebhookDedupeStore(24 * 60 * 60 * 1000);
const WEBHOOK_EDGE_STATE_STORE = new FirestoreWebhookEdgeStateStore({
  dedupeTtlMs: 24 * 60 * 60 * 1000,
  orderingTtlMs: 24 * 60 * 60 * 1000,
  inMemoryDedupe: WEBHOOK_DEDUPE_STORE
});

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

function normalizeReasonList(value, limit) {
  const rows = Array.isArray(value) ? value : [];
  const max = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 8;
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeReplyText(item).toLowerCase();
    if (!normalized) return;
    if (out.includes(normalized)) return;
    if (out.length >= max) return;
    out.push(normalized);
  });
  return out;
}

function normalizeJourneyMessage(value) {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  if (!row || typeof row.type !== 'string' || !row.type.trim()) return null;
  return row;
}

function createJourneyFallbackText(text) {
  return {
    type: 'text',
    text: normalizeReplyText(text) || '設定を更新しました。'
  };
}

async function sendJourneyResponse(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const journey = payload.journey && typeof payload.journey === 'object' ? payload.journey : null;
  if (!journey || journey.handled !== true) return false;
  const replyToken = payload.replyToken;
  const lineUserId = payload.lineUserId;
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim() ? payload.requestId.trim() : null;
  const replyFn = payload.replyFn;
  const pushFn = payload.pushFn;
  if (!replyToken || typeof replyFn !== 'function') return false;

  const replyMessages = [];
  if (Array.isArray(journey.replyMessages)) {
    journey.replyMessages.forEach((item) => {
      const normalized = normalizeJourneyMessage(item);
      if (normalized) replyMessages.push(normalized);
    });
  } else {
    const single = normalizeJourneyMessage(journey.replyMessage);
    if (single) replyMessages.push(single);
  }
  if (!replyMessages.length) {
    replyMessages.push(createJourneyFallbackText(journey.replyText));
  }

  await replyFn(replyToken, replyMessages[0]);

  const pushQueue = []
    .concat(replyMessages.slice(1))
    .concat(Array.isArray(journey.followupMessages)
      ? journey.followupMessages.map((item) => normalizeJourneyMessage(item)).filter(Boolean)
      : []);
  if (pushQueue.length && lineUserId && typeof pushFn === 'function') {
    for (const message of pushQueue) {
      // eslint-disable-next-line no-await-in-loop
      await pushFn(lineUserId, message);
    }
  }
  const sectionMeta = journey.sectionMeta && typeof journey.sectionMeta === 'object' ? journey.sectionMeta : null;
  if (sectionMeta && lineUserId) {
    await appendAuditLog({
      actor: lineUserId,
      action: 'journey.todo_detail.section.replied',
      entityType: 'journey_todo_detail_section',
      entityId: `${lineUserId}:${sectionMeta.todoKey || 'todo'}:${sectionMeta.section || 'section'}`,
      traceId,
      requestId,
      payloadSummary: {
        taskKey: sectionMeta.taskKey || null,
        taskKeySource: sectionMeta.taskKeySource || null,
        section: sectionMeta.section || null,
        startChunk: Number(sectionMeta.startChunk) || 1,
        totalChunks: Number(sectionMeta.totalChunks) || 0,
        visibleChunkCount: Number(sectionMeta.visibleChunkCount) || 0,
        continuationRequired: sectionMeta.continuationRequired === true,
        safetyValveApplied: sectionMeta.safetyValveApplied === true
      }
    }).catch(() => null);
  }
  return true;
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

function shouldReplyWithRegionAlreadySet(text) {
  const raw = normalizeReplyText(text);
  if (!raw) return false;
  const parsed = parseRegionInput(raw);
  if (parsed && parsed.ok === true) return true;
  return /^(?:地域(?:設定|変更)?|region|city|state)(?:\s|[:：]|$)/i.test(raw);
}

function trimForLineMessage(value) {
  const text = normalizeReplyText(value);
  if (!text) return '';
  return text.length > 4500 ? `${text.slice(0, 4500)}...` : text;
}

function trimForPaidLineMessage(value) {
  const text = trimForLineMessage(value);
  if (!text) return '';
  return text.length > 420 ? `${text.slice(0, 420)}…` : text;
}

function stripLegacyTemplateTokensForPaid(value) {
  const text = normalizeReplyText(value);
  if (!text) return '';
  const pattern = new RegExp(FORBIDDEN_REPLY_PATTERN.source, 'gi');
  return text
    .replace(pattern, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectLegacyTemplateHit(value) {
  const text = normalizeReplyText(value);
  if (!text) return false;
  return containsLegacyTemplateTerms(text);
}

function guardPaidMainReplyText(value, options) {
  const payload = options && typeof options === 'object' ? options : {};
  const fallbackText = normalizeReplyText(payload.fallbackText)
    || '状況を整理しながら進めましょう。まずは優先する手続きを1つ決めるのがおすすめです。';
  if (payload.preserveReplyText === true) {
    const guardedText = trimForPaidLineMessage(
      normalizeReplyText(value)
      || stripLegacyTemplateTokensForPaid(value)
      || fallbackText
    ) || fallbackText;
    return {
      replyText: guardedText,
      legacyTemplateHit: detectLegacyTemplateHit(value),
      actionCount: countActionBullets(guardedText),
      pitfallIncluded: detectPitfallIncluded(guardedText),
      followupQuestionIncluded: detectFollowupQuestionIncluded(guardedText),
      fallbackTemplateKind: classifyReplyTemplateKind({
        replyText: guardedText,
        conciseModeApplied: payload.conciseMode === true
      }),
      replyTemplateFingerprint: buildReplyTemplateFingerprint(guardedText)
    };
  }
  const guardResult = sanitizePaidMainReply(value, payload);
  const guardedText = trimForPaidLineMessage(
    normalizeReplyText(guardResult && guardResult.text ? guardResult.text : '')
      || stripLegacyTemplateTokensForPaid(value)
      || fallbackText
  ) || fallbackText;
  return {
    replyText: guardedText,
    legacyTemplateHit: guardResult ? guardResult.legacyTemplateHit === true : detectLegacyTemplateHit(value),
    actionCount: guardResult && Number.isFinite(Number(guardResult.actionCount))
      ? Number(guardResult.actionCount)
      : countActionBullets(guardedText),
    pitfallIncluded: guardResult ? guardResult.pitfallIncluded === true : detectPitfallIncluded(guardedText),
    followupQuestionIncluded: guardResult
      ? guardResult.followupQuestionIncluded === true
      : detectFollowupQuestionIncluded(guardedText),
    fallbackTemplateKind: guardResult && typeof guardResult.templateKind === 'string'
      ? guardResult.templateKind
      : classifyReplyTemplateKind({ replyText: guardedText }),
    replyTemplateFingerprint: guardResult && typeof guardResult.replyTemplateFingerprint === 'string'
      ? guardResult.replyTemplateFingerprint
      : buildReplyTemplateFingerprint(guardedText)
  };
}

function countActionBullets(value) {
  const text = normalizeReplyText(value);
  if (!text) return 0;
  return text
    .split('\n')
    .filter((line) => line.trim().startsWith('・') || line.trim().startsWith('- '))
    .length;
}

function detectPitfallIncluded(value) {
  const text = normalizeReplyText(value);
  if (!text) return false;
  return /(詰まりやすい|注意|リスク|気をつけ)/.test(text);
}

function detectFollowupQuestionIncluded(value) {
  const text = normalizeReplyText(value);
  if (!text) return false;
  return /[?？]$/.test(text) || text.includes('ですか？') || text.includes('ますか？');
}

function buildLowRelevanceConversationReply(questionText) {
  const question = normalizeReplyText(questionText);
  const draftPacket = composeConversationDraftFromSignals({
    summary: 'いまの質問だけでは対象手続きを特定できません。',
    nextActions: [
      '対象手続きを1つ指定する（例: ビザ更新 / 住居契約 / 税務）',
      '期限を1つ添える（例: 1週間後）'
    ],
    pitfall: '対象手続きと期限が曖昧なまま進めると、案内の精度が下がります。',
    question: '対象手続き名と期限を1つずつ教えてください。',
    state: 'CLARIFY',
    move: 'Narrow'
  });
  const styleDecision = Object.assign({}, selectConversationStyle({
    topic: 'general',
    question,
    userTier: 'paid',
    journeyPhase: 'pre',
    messageLength: question.length,
    timeOfDay: new Date().getHours(),
    urgency: 'high'
  }), {
    askClarifying: true,
    maxActions: 2
  });
  const humanized = humanizeConversationMessage({ draftPacket, styleDecision });
  return trimForLineMessage(humanized.text || draftPacket.draft);
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

function resolvePaidOpportunityEngineEnabled() {
  return resolveBooleanEnvFlag('ENABLE_PAID_OPPORTUNITY_ENGINE_V1', false);
}

function resolveConversationRouterEnabled() {
  return resolveBooleanEnvFlag('ENABLE_CONVERSATION_ROUTER', true);
}

function resolvePaidOrchestratorEnabled() {
  return resolveBooleanEnvFlag('ENABLE_PAID_ORCHESTRATOR_V2', true);
}

function resolveV1ChannelEdgeEnabled() {
  return resolveBooleanEnvFlag('ENABLE_V1_CHANNEL_EDGE', true);
}

function resolveV1FastSlowDispatchEnabled() {
  return resolveBooleanEnvFlag('ENABLE_V1_FAST_SLOW_DISPATCH', false);
}

function resolveV1ActionGatewayEnabled() {
  return resolveBooleanEnvFlag('ENABLE_V1_ACTION_GATEWAY', false);
}

function resolvePaidInterventionCooldownTurns() {
  const raw = Number(process.env.PAID_INTERVENTION_COOLDOWN_TURNS || 5);
  if (!Number.isFinite(raw)) return 5;
  return Math.max(1, Math.min(20, Math.floor(raw)));
}

async function resolveLlmConciergeEnabledBestEffort() {
  try {
    return await getLlmConciergeEnabled();
  } catch (_err) {
    return false;
  }
}

async function resolveLlmWebSearchEnabledBestEffort() {
  try {
    return await getLlmWebSearchEnabled();
  } catch (_err) {
    return true;
  }
}

async function resolveLlmStyleEngineEnabledBestEffort() {
  try {
    return await getLlmStyleEngineEnabled();
  } catch (_err) {
    return true;
  }
}

async function resolveLlmBanditEnabledBestEffort() {
  try {
    return await getLlmBanditEnabled();
  } catch (_err) {
    return false;
  }
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

function buildDefaultOpportunityDecision() {
  return {
    conversationMode: 'casual',
    opportunityType: 'none',
    opportunityReasonKeys: [],
    interventionBudget: 0,
    suggestedAtoms: {
      nextActions: [],
      pitfall: null,
      question: null
    }
  };
}

function withRouterReasonOnOpportunityDecision(opportunityDecision, routerReason) {
  const base = opportunityDecision && typeof opportunityDecision === 'object'
    ? opportunityDecision
    : buildDefaultOpportunityDecision();
  const normalizedReason = typeof routerReason === 'string'
    ? routerReason.trim().toLowerCase().replace(/\s+/g, '_')
    : '';
  if (!normalizedReason) return base;
  const reasonKeys = Array.isArray(base.opportunityReasonKeys)
    ? base.opportunityReasonKeys
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => item.trim().toLowerCase())
    : [];
  if (!reasonKeys.includes(normalizedReason)) reasonKeys.push(normalizedReason);
  return Object.assign({}, base, {
    opportunityReasonKeys: reasonKeys.slice(0, 8)
  });
}

function resolveOpportunityRiskFlags(snapshot) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const riskFlags = Array.isArray(source.riskFlags)
    ? source.riskFlags
    : (Array.isArray(source.riskFlagsTop3) ? source.riskFlagsTop3 : []);
  return uniqueStringList(riskFlags).slice(0, 5);
}

function buildOpportunityInput(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const contextSnapshot = payload.contextSnapshot && typeof payload.contextSnapshot === 'object'
    ? payload.contextSnapshot
    : null;
  const conciergeContext = buildConciergeContextSnapshot(contextSnapshot);
  return {
    lineUserId: payload.lineUserId || '',
    userTier: payload.userTier || 'free',
    messageText: payload.messageText || '',
    journeyPhase: conciergeContext && conciergeContext.phase
      ? conciergeContext.phase
      : (contextSnapshot && contextSnapshot.phase ? contextSnapshot.phase : ''),
    topTasks: conciergeContext && Array.isArray(conciergeContext.topTasks)
      ? conciergeContext.topTasks
      : [],
    blockedTask: conciergeContext && conciergeContext.blockedTask ? conciergeContext.blockedTask : null,
    dueSoonTask: conciergeContext && conciergeContext.dueSoonTask ? conciergeContext.dueSoonTask : null,
    riskFlags: resolveOpportunityRiskFlags(contextSnapshot),
    recentEngagement: payload.recentEngagement && typeof payload.recentEngagement === 'object'
      ? payload.recentEngagement
      : { recentTurns: 5, recentInterventions: 0, recentClicks: false, recentTaskDone: false },
    safetySnapshot: {
      killSwitchOn: false
    },
    llmConciergeEnabled: payload.llmConciergeEnabled === true
  };
}

async function loadFreshContextSnapshotBestEffort(lineUserId) {
  if (!lineUserId || typeof lineUserId !== 'string') return null;
  try {
    const result = await getUserContextSnapshot({
      lineUserId,
      maxAgeHours: 24 * 14
    });
    if (!result || result.ok !== true || result.stale === true) return null;
    return result.snapshot || null;
  } catch (_err) {
    return null;
  }
}

async function buildPaidDomainConciergeResult(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = payload.lineUserId;
  const text = normalizeReplyText(payload.text);
  const domainIntent = normalizeDomainIntent(payload.domainIntent);
  const contextSnapshot = payload.contextSnapshot || await loadFreshContextSnapshotBestEffort(lineUserId);
  const recentTurns = resolvePaidInterventionCooldownTurns();
  const recentEngagement = payload.recentEngagement && typeof payload.recentEngagement === 'object'
    ? payload.recentEngagement
    : await loadRecentInterventionSignals({
      lineUserId,
      recentTurns
    }).catch(() => ({
      recentTurns,
      recentInterventions: 0,
      recentClicks: false,
      recentTaskDone: false
    }));
  let opportunityDecision = payload.opportunityDecision && typeof payload.opportunityDecision === 'object'
    ? payload.opportunityDecision
    : detectOpportunity(buildOpportunityInput({
      lineUserId,
      userTier: 'paid',
      messageText: text,
      contextSnapshot,
      recentEngagement,
      llmConciergeEnabled: true
    }));
  if (payload.forceConcierge === true && opportunityDecision.conversationMode !== 'concierge') {
    const forcedReasons = Array.isArray(opportunityDecision.opportunityReasonKeys)
      ? opportunityDecision.opportunityReasonKeys.slice(0, 8)
      : [];
    if (!forcedReasons.includes('paid_fallback_concierge')) forcedReasons.push('paid_fallback_concierge');
    opportunityDecision = Object.assign({}, opportunityDecision, {
      conversationMode: 'concierge',
      opportunityType: opportunityDecision.opportunityType === 'none' ? 'action' : opportunityDecision.opportunityType,
      opportunityReasonKeys: forcedReasons.slice(0, 8),
      interventionBudget: 1
    });
  }
  const derivedRecentFollowupIntents = Array.isArray(payload.recentFollowupIntents) && payload.recentFollowupIntents.length
    ? payload.recentFollowupIntents
      .map((item) => normalizeReplyText(item).toLowerCase())
      .filter(Boolean)
      .slice(0, 6)
    : listRecentTurns(lineUserId, recentTurns)
      .map((row) => normalizeReplyText(row && row.followupIntent).toLowerCase())
      .filter(Boolean)
      .slice(0, 6);
  const domainReply = domainIntent === 'housing'
    ? generatePaidHousingConciergeReply({
      lineUserId,
      messageText: text,
      contextSnapshot,
      contextResumeDomain: payload.contextResumeDomain || null,
      opportunityDecision,
      followupIntent: payload.followupIntent || null,
      recentFollowupIntents: derivedRecentFollowupIntents,
      blockedReason: payload.blockedReason || null
    })
    : generatePaidDomainConciergeReply({
      lineUserId,
      messageText: text,
      domainIntent,
      contextSnapshot,
      contextResumeDomain: payload.contextResumeDomain || null,
      opportunityDecision,
      followupIntent: payload.followupIntent || null,
      recentFollowupIntents: derivedRecentFollowupIntents,
      recentResponseHints: Array.isArray(payload.recentResponseHints) ? payload.recentResponseHints : [],
      requestContract: payload.requestContract && typeof payload.requestContract === 'object'
        ? payload.requestContract
        : null,
      recoverySignal: payload.recoverySignal === true,
      blockedReason: payload.blockedReason || null
    });
  const domainAtoms = domainReply && domainReply.atoms && typeof domainReply.atoms === 'object'
    ? domainReply.atoms
    : null;
  const conciergeContext = buildConciergeContextSnapshot(contextSnapshot);
  const journeySignals = resolveJourneyActionSignals({
    contextSnapshot,
    blockedTask: conciergeContext && conciergeContext.blockedTask ? conciergeContext.blockedTask : null,
    journeyPhase: conciergeContext && conciergeContext.phase ? conciergeContext.phase : null,
    nextActions: domainAtoms && Array.isArray(domainAtoms.nextActions) ? domainAtoms.nextActions : []
  });
  const [cityPackSignals, emergencySignals] = await Promise.all([
    resolveRuntimeCityPackSignals({
      lineUserId,
      locale: 'ja',
      domainIntent,
      intentRiskTier: resolveIntentRiskTier({ domainIntent }).intentRiskTier
    }),
    resolveRuntimeEmergencySignals({
      lineUserId,
      contextSnapshot
    })
  ]);
  const fallbackReplyText = '状況を整理しながら進めましょう。まずは優先する手続きを3つ以内に絞るのがおすすめです。';
  const rawReplyText = domainReply && domainReply.replyText ? domainReply.replyText : fallbackReplyText;
  const guardedReply = guardPaidMainReplyText(rawReplyText, {
    fallbackText: fallbackReplyText,
    situationLine: domainAtoms && typeof domainAtoms.situationLine === 'string'
      ? domainAtoms.situationLine
      : '',
    nextActions: domainAtoms && Array.isArray(domainAtoms.nextActions)
      ? domainAtoms.nextActions
      : (opportunityDecision && opportunityDecision.suggestedAtoms && Array.isArray(opportunityDecision.suggestedAtoms.nextActions)
        ? opportunityDecision.suggestedAtoms.nextActions
        : []),
    pitfall: domainAtoms && typeof domainAtoms.pitfall === 'string'
      ? domainAtoms.pitfall
      : (opportunityDecision && opportunityDecision.suggestedAtoms
        ? opportunityDecision.suggestedAtoms.pitfall
        : ''),
    followupQuestion: domainAtoms && typeof domainAtoms.followupQuestion === 'string'
      ? domainAtoms.followupQuestion
      : (opportunityDecision && opportunityDecision.suggestedAtoms
        ? opportunityDecision.suggestedAtoms.question
        : ''),
    conciseMode: domainReply && domainReply.conciseModeApplied === true,
    preserveReplyText: domainReply && domainReply.preserveReplyText === true
  });
  const replyText = guardedReply.replyText;
  const conversationQuality = buildConversationQualityMeta({
    replyText,
    messageText: text,
    domainIntent,
    nextActions: domainAtoms && Array.isArray(domainAtoms.nextActions)
      ? domainAtoms.nextActions
      : (opportunityDecision && opportunityDecision.suggestedAtoms
        ? opportunityDecision.suggestedAtoms.nextActions
        : []),
    opportunityReasonKeys: opportunityDecision ? opportunityDecision.opportunityReasonKeys : [],
    fallbackType: payload.blockedReason ? 'domain_concierge_fallback' : 'domain_concierge',
    legacyTemplateHit: guardedReply.legacyTemplateHit === true,
    pitfallIncluded: guardedReply.pitfallIncluded === true,
    followupQuestionIncluded: guardedReply.followupQuestionIncluded === true,
    conversationNaturalnessVersion: payload.conversationNaturalnessVersion || 'v2',
    conciseModeApplied: domainReply && domainReply.conciseModeApplied === true,
    followupIntent: domainReply && typeof domainReply.followupIntent === 'string' ? domainReply.followupIntent : null,
    strategyReason: payload.blockedReason ? 'domain_concierge_fallback' : 'explicit_domain_intent',
    selectedCandidateKind: 'domain_concierge_candidate',
    selectedByDirectAnswerFirst: true,
    retrievalBlockedByStrategy: true,
    retrievalBlockReason: 'strategy_domain_concierge',
    fallbackTemplateKind: guardedReply.fallbackTemplateKind,
    finalizerTemplateKind: guardedReply.fallbackTemplateKind,
    replyTemplateFingerprint: guardedReply.replyTemplateFingerprint,
    priorContextUsed: typeof payload.contextResumeDomain === 'string' && payload.contextResumeDomain.trim().length > 0,
    followupResolvedFromHistory: payload.followupCarryFromHistory === true,
    continuationReason: payload.contextResumeDomain ? 'context_resume_domain' : null,
    knowledgeCandidateCountBySource: {
      faq: 0,
      savedFaq: 0,
      cityPack: cityPackSignals && cityPackSignals.cityPackGrounded === true ? 1 : 0,
      sourceRefs: Array.isArray(cityPackSignals && cityPackSignals.sourceSnapshotRefs)
        ? cityPackSignals.sourceSnapshotRefs.length
        : 0,
      webSearch: 0
    },
    knowledgeCandidateUsed: cityPackSignals && cityPackSignals.cityPackGrounded === true,
    knowledgeCandidateRejectedReason: null,
    cityPackCandidateAvailable: cityPackSignals && cityPackSignals.cityPackGrounded === true,
    cityPackRejectedReason: cityPackSignals && cityPackSignals.cityPackGrounded === true ? null : 'domain_concierge_city_pack_unavailable',
    cityPackUsedInAnswer: cityPackSignals && cityPackSignals.cityPackGrounded === true,
    savedFaqCandidateAvailable: false,
    savedFaqRejectedReason: 'domain_concierge_saved_faq_unavailable',
    savedFaqUsedInAnswer: false,
    sourceReadinessDecisionSource: cityPackSignals && cityPackSignals.cityPackGrounded === true
      ? 'domain_concierge_city_pack_signal'
      : 'domain_concierge_strategy_default',
    knowledgeGroundingKind: cityPackSignals && cityPackSignals.cityPackGrounded === true ? 'city_pack' : null,
    genericFallbackSlice: resolveGenericFallbackSlice({
      messageText: text,
      domainIntent,
      followupIntent: domainReply && typeof domainReply.followupIntent === 'string' ? domainReply.followupIntent : null,
      routerReason: payload.routerReason || null,
      priorContextUsed: typeof payload.contextResumeDomain === 'string' && payload.contextResumeDomain.trim().length > 0,
      followupResolvedFromHistory: payload.followupCarryFromHistory === true,
      continuationReason: payload.contextResumeDomain ? 'context_resume_domain' : null
    })
  });
  return {
    ok: true,
    replyText,
    preserveReplyText: domainReply && domainReply.preserveReplyText === true,
    contextSnapshot,
    opportunityDecision,
    conciergeMeta: domainReply && domainReply.auditMeta ? domainReply.auditMeta : null,
    conversationQuality,
    atoms: domainAtoms,
    followupIntent: domainReply && typeof domainReply.followupIntent === 'string' ? domainReply.followupIntent : null,
    conciseModeApplied: domainReply && domainReply.conciseModeApplied === true,
    telemetry: {
      strategyReason: conversationQuality.strategyReason,
      selectedCandidateKind: conversationQuality.selectedCandidateKind,
      selectedByDirectAnswerFirst: conversationQuality.selectedByDirectAnswerFirst,
      retrievalBlockedByStrategy: conversationQuality.retrievalBlockedByStrategy,
      retrievalBlockReason: conversationQuality.retrievalBlockReason,
      fallbackTemplateKind: conversationQuality.fallbackTemplateKind,
      finalizerTemplateKind: conversationQuality.finalizerTemplateKind,
      replyTemplateFingerprint: conversationQuality.replyTemplateFingerprint,
      priorContextUsed: conversationQuality.priorContextUsed,
      followupResolvedFromHistory: conversationQuality.followupResolvedFromHistory,
      continuationReason: conversationQuality.continuationReason,
      knowledgeCandidateCountBySource: conversationQuality.knowledgeCandidateCountBySource,
      knowledgeCandidateUsed: conversationQuality.knowledgeCandidateUsed,
      knowledgeCandidateRejectedReason: conversationQuality.knowledgeCandidateRejectedReason,
      cityPackCandidateAvailable: conversationQuality.cityPackCandidateAvailable,
      cityPackRejectedReason: conversationQuality.cityPackRejectedReason,
      cityPackUsedInAnswer: conversationQuality.cityPackUsedInAnswer,
      savedFaqCandidateAvailable: conversationQuality.savedFaqCandidateAvailable,
      savedFaqRejectedReason: conversationQuality.savedFaqRejectedReason,
      savedFaqUsedInAnswer: conversationQuality.savedFaqUsedInAnswer,
      sourceReadinessDecisionSource: conversationQuality.sourceReadinessDecisionSource,
      knowledgeGroundingKind: conversationQuality.knowledgeGroundingKind,
      genericFallbackSlice: conversationQuality.genericFallbackSlice
    },
    integrationSignals: Object.assign({}, journeySignals, cityPackSignals, emergencySignals, {
      savedFaqReused: false,
      savedFaqReusePass: false,
      crossSystemConflictDetected: false
    })
  };
}

async function replyWithPaidDomainConcierge(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const result = await buildPaidDomainConciergeResult(payload);
  const semanticReplyEnvelope = buildSemanticReplyEnvelope({
    replyText: result.replyText,
    domainIntent: payload.domainIntent || (result.conversationQuality && result.conversationQuality.domainIntent) || 'general',
    conversationMode: result.opportunityDecision && result.opportunityDecision.conversationMode
      ? result.opportunityDecision.conversationMode
      : 'concierge',
    eventSource: payload.eventSource,
    pathType: 'slow',
    uUnits: ['U-05', 'U-06', 'U-09', 'U-10', 'U-11', 'U-12', 'U-13', 'U-16', 'U-17', 'U-23'],
    nextSteps: result.atoms && Array.isArray(result.atoms.nextActions) ? result.atoms.nextActions : [],
    followupQuestion: result.atoms && typeof result.atoms.followupQuestion === 'string'
      ? result.atoms.followupQuestion
      : null,
    warnings: result.conciergeMeta && Array.isArray(result.conciergeMeta.blockedReasons)
      ? result.conciergeMeta.blockedReasons
      : [],
    legalSnapshot: payload.legalSnapshot || null,
    sourceAuthorityScore: result.conciergeMeta && Number.isFinite(Number(result.conciergeMeta.sourceAuthorityScore))
      ? Number(result.conciergeMeta.sourceAuthorityScore)
      : null,
    sourceFreshnessScore: result.conciergeMeta && Number.isFinite(Number(result.conciergeMeta.sourceFreshnessScore))
      ? Number(result.conciergeMeta.sourceFreshnessScore)
      : null,
    sourceReadinessDecision: result.conciergeMeta && typeof result.conciergeMeta.sourceReadinessDecision === 'string'
      ? result.conciergeMeta.sourceReadinessDecision
      : null,
    officialOnlySatisfied: result.conciergeMeta ? result.conciergeMeta.officialOnlySatisfied === true : false,
    readinessDecision: result.conciergeMeta && typeof result.conciergeMeta.readinessDecision === 'string'
      ? result.conciergeMeta.readinessDecision
      : null,
    readinessReasonCodes: result.conciergeMeta && Array.isArray(result.conciergeMeta.readinessReasonCodes)
      ? result.conciergeMeta.readinessReasonCodes
      : []
  });
  await payload.replyFn(
    payload.replyToken,
    semanticReplyEnvelope.lineMessage || { type: 'text', text: semanticReplyEnvelope.replyText }
  );
  return Object.assign({}, result, semanticReplyEnvelope);
}

async function replyWithPaidHousingConcierge(params) {
  const payload = params && typeof params === 'object' ? params : {};
  return replyWithPaidDomainConcierge(Object.assign({}, payload, {
    domainIntent: 'housing'
  }));
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

function uniqueStringList(values) {
  const rows = Array.isArray(values) ? values : [];
  const seen = new Set();
  const out = [];
  rows.forEach((item) => {
    const text = normalizeReplyText(item);
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });
  return out;
}

async function resolveLinkRegistryCandidatesFromSourceIds(sourceIds, sourceLabel) {
  const ids = uniqueStringList(sourceIds);
  if (!ids.length) return [];
  const rows = await Promise.all(ids.map(async (sourceId) => {
    try {
      const link = await linkRegistryRepo.getLink(sourceId);
      if (!link || typeof link.url !== 'string' || !link.url.trim()) return null;
      return {
        url: link.url.trim(),
        source: sourceLabel || 'link_registry',
        sourceType: 'official',
        domainClass: link.domainClass || 'unknown',
        title: link.title || sourceId,
        snippet: link.description || '',
        sourceId
      };
    } catch (_err) {
      return null;
    }
  }));
  return rows.filter(Boolean);
}

async function resolveFaqStoredCandidatesFromRetrieval(retrieval) {
  const faqCandidates = Array.isArray(retrieval && retrieval.faqCandidates) ? retrieval.faqCandidates : [];
  const sourceIds = faqCandidates.flatMap((row) => (Array.isArray(row && row.linkRegistryIds) ? row.linkRegistryIds : []));
  return resolveLinkRegistryCandidatesFromSourceIds(sourceIds, 'faq_link_registry');
}

async function resolveCityPackStoredCandidatesFromRetrieval(retrieval) {
  const cityPackCandidates = Array.isArray(retrieval && retrieval.cityPackCandidates) ? retrieval.cityPackCandidates : [];
  const cityPackIds = uniqueStringList(cityPackCandidates.map((row) => row && row.sourceId));
  if (!cityPackIds.length) return [];
  const sourceRefIds = [];
  for (const cityPackId of cityPackIds.slice(0, 3)) {
    try {
      const cityPack = await cityPacksRepo.getCityPack(cityPackId);
      if (!cityPack || !Array.isArray(cityPack.sourceRefs)) continue;
      sourceRefIds.push(...cityPack.sourceRefs);
    } catch (_err) {
      // fail closed
    }
  }
  const refs = uniqueStringList(sourceRefIds);
  if (!refs.length) return [];
  const rows = await Promise.all(refs.map(async (sourceRefId) => {
    try {
      const sourceRef = await sourceRefsRepo.getSourceRef(sourceRefId);
      if (!sourceRef || typeof sourceRef.url !== 'string' || !sourceRef.url.trim()) return null;
      return {
        url: sourceRef.url.trim(),
        source: 'city_pack_source_ref',
        sourceType: sourceRef.sourceType || 'other',
        authorityLevel: sourceRef.authorityLevel || 'other',
        requiredLevel: sourceRef.requiredLevel || 'required',
        validUntil: sourceRef.validUntil || null,
        status: sourceRef.status || 'active',
        domainClass: sourceRef.domainClass || 'unknown',
        title: sourceRefId,
        snippet: '',
        sourceRefId
      };
    } catch (_err) {
      return null;
    }
  }));
  return rows.filter(Boolean);
}

async function resolveStoredCandidatesForPaid(paid, options) {
  const payload = options && typeof options === 'object' ? options : {};
  const evidenceKeys = uniqueStringList([]
    .concat(Array.isArray(paid && paid.citations) ? paid.citations : [])
    .concat(Array.isArray(paid && paid.output && paid.output.evidenceKeys) ? paid.output.evidenceKeys : []));
  const articleRows = evidenceKeys.length
    ? await Promise.all(evidenceKeys.slice(0, 8).map(async (articleId) => {
      try {
        return await faqArticlesRepo.getArticle(articleId);
      } catch (_err) {
        return null;
      }
    }))
    : [];
  const sourceIds = articleRows.filter(Boolean)
    .flatMap((row) => (Array.isArray(row.linkRegistryIds) ? row.linkRegistryIds : []));
  const [faqStored, cityPackStored] = await Promise.all([
    resolveLinkRegistryCandidatesFromSourceIds(sourceIds, 'faq_link_registry'),
    payload.lineUserId
      ? searchCityPackCandidates({
        lineUserId: payload.lineUserId,
        locale: payload.locale || 'ja',
        limit: 3
      }).then((result) => resolveCityPackStoredCandidatesFromRetrieval({
        cityPackCandidates: Array.isArray(result && result.candidates) ? result.candidates : []
      })).catch(() => [])
      : []
  ]);
  return faqStored.concat(cityPackStored);
}

function normalizeAssistantQuality(input, defaults) {
  const payload = input && typeof input === 'object' ? input : {};
  const base = defaults && typeof defaults === 'object' ? defaults : {};
  const intentResolved = normalizeReplyText(payload.intentResolved || base.intentResolved || '');
  const blockedStage = normalizeReplyText(payload.blockedStage || base.blockedStage || '');
  const fallbackReason = normalizeReplyText(payload.fallbackReason || base.fallbackReason || '');
  return {
    intentResolved: intentResolved || null,
    kbTopScore: Number.isFinite(Number(payload.kbTopScore))
      ? Number(payload.kbTopScore)
      : (Number.isFinite(Number(base.kbTopScore)) ? Number(base.kbTopScore) : 0),
    evidenceCoverage: Number.isFinite(Number(payload.evidenceCoverage))
      ? Number(payload.evidenceCoverage)
      : (Number.isFinite(Number(base.evidenceCoverage)) ? Number(base.evidenceCoverage) : 0),
    blockedStage: blockedStage || null,
    fallbackReason: fallbackReason || null
  };
}

function normalizeDomainIntent(value) {
  const normalized = normalizeReplyText(value).toLowerCase();
  if (PAID_CONCIERGE_DOMAIN_INTENTS.has(normalized)) return normalized;
  return 'general';
}

function normalizeFollowupIntent(value) {
  const normalized = normalizeReplyText(value).toLowerCase();
  if (normalized === 'docs_required' || normalized === 'appointment_needed' || normalized === 'next_step') {
    return normalized;
  }
  return null;
}

function resolveInterventionSuppressedBy(opportunityReasonKeys) {
  const reasons = Array.isArray(opportunityReasonKeys) ? opportunityReasonKeys : [];
  if (reasons.includes('intervention_cooldown_active')) return 'cooldown';
  if (reasons.includes('non_paid_tier')) return 'tier';
  return null;
}

function buildConversationQualityMeta(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const replyText = normalizeReplyText(payload.replyText);
  const domainIntent = normalizeDomainIntent(payload.domainIntent);
  const actionCountFromAtoms = Array.isArray(payload.nextActions) ? payload.nextActions.length : null;
  const actionCountFromReply = countActionBullets(replyText);
  const actionCount = Number.isFinite(Number(actionCountFromAtoms))
    ? Math.max(0, Math.min(3, Math.floor(Number(actionCountFromAtoms))))
    : Math.max(0, Math.min(3, actionCountFromReply));
  const pitfallIncluded = payload.pitfallIncluded === true ? true : detectPitfallIncluded(replyText);
  const followupQuestionIncluded = payload.followupQuestionIncluded === true
    ? true
    : detectFollowupQuestionIncluded(replyText);
  const legacyTemplateHit = payload.legacyTemplateHit === true ? true : detectLegacyTemplateHit(replyText);
  const fallbackType = normalizeReplyText(payload.fallbackType).toLowerCase() || null;
  const conversationNaturalnessVersion = normalizeReplyText(payload.conversationNaturalnessVersion) || 'v1';
  const followupIntent = normalizeFollowupIntent(payload.followupIntent);
  const conciseModeApplied = payload.conciseModeApplied === true;
  const repetitionPrevented = payload.repetitionPrevented === true;
  const directAnswerApplied = payload.directAnswerApplied === true;
  const clarifySuppressed = payload.clarifySuppressed === true;
  const recoverySignal = payload.recoverySignal === true;
  const followupCarryFromHistory = payload.followupCarryFromHistory === true;
  const misunderstandingRecovered = payload.misunderstandingRecovered === true
    || (
      recoverySignal
      && (
        directAnswerApplied
        || clarifySuppressed
        || repetitionPrevented
        || followupCarryFromHistory
      )
    );
  const contextCarryScore = Number.isFinite(Number(payload.contextCarryScore))
    ? Math.max(0, Math.min(1, Number(payload.contextCarryScore)))
    : 0;
  const repeatRiskScore = Number.isFinite(Number(payload.repeatRiskScore))
    ? Math.max(0, Math.min(1, Number(payload.repeatRiskScore)))
    : 0;
  const fallbackTemplateKind = normalizeReplyText(payload.fallbackTemplateKind).toLowerCase()
    || classifyReplyTemplateKind({
      replyText,
      candidateKind: payload.selectedCandidateKind || null,
      readinessDecision: payload.readinessDecision || null,
      conciseModeApplied
    });
  const finalizerTemplateKind = normalizeReplyText(payload.finalizerTemplateKind).toLowerCase()
    || classifyReplyTemplateKind({
      replyText,
      candidateKind: payload.selectedCandidateKind || null,
      readinessDecision: payload.readinessDecision || null,
      conciseModeApplied
    });
  const genericFallbackSlice = normalizeReplyText(payload.genericFallbackSlice).toLowerCase()
    || resolveGenericFallbackSlice({
      messageText: payload.messageText || '',
      domainIntent,
      followupIntent,
      routerReason: payload.routerReason || null,
      priorContextUsed: payload.priorContextUsed === true,
      followupResolvedFromHistory: payload.followupResolvedFromHistory === true,
      continuationReason: payload.continuationReason || null
    });
  const knowledgeCandidateCountBySource = payload.knowledgeCandidateCountBySource
    && typeof payload.knowledgeCandidateCountBySource === 'object'
    ? Object.assign({}, payload.knowledgeCandidateCountBySource)
    : null;
  return {
    replyTextLineage: replyText || null,
    conversationNaturalnessVersion,
    legacyTemplateHit,
    followupQuestionIncluded,
    actionCount,
    pitfallIncluded,
    domainIntent,
    fallbackType,
    interventionSuppressedBy: resolveInterventionSuppressedBy(payload.opportunityReasonKeys),
    followupIntent,
    conciseModeApplied,
    repetitionPrevented,
    directAnswerApplied,
    clarifySuppressed,
    misunderstandingRecovered,
    contextCarryScore,
    repeatRiskScore,
    strategyReason: normalizeReplyText(payload.strategyReason).toLowerCase() || null,
    strategyAlternativeSet: Array.isArray(payload.strategyAlternativeSet)
      ? payload.strategyAlternativeSet
        .map((item) => normalizeReplyText(item).toLowerCase())
        .filter(Boolean)
        .slice(0, 8)
      : [],
    strategyPriorityVersion: normalizeReplyText(payload.strategyPriorityVersion) || null,
    fallbackPriorityReason: normalizeReplyText(payload.fallbackPriorityReason).toLowerCase() || null,
    selectedCandidateKind: normalizeReplyText(payload.selectedCandidateKind).toLowerCase() || null,
    selectedByDirectAnswerFirst: payload.selectedByDirectAnswerFirst === true,
    retrievalBlockedByStrategy: payload.retrievalBlockedByStrategy === true,
    retrievalBlockReason: normalizeReplyText(payload.retrievalBlockReason).toLowerCase() || null,
    retrievalPermitReason: normalizeReplyText(payload.retrievalPermitReason).toLowerCase() || null,
    retrievalReenabledBySlice: normalizeReplyText(payload.retrievalReenabledBySlice).toLowerCase() || null,
    fallbackTemplateKind,
    finalizerTemplateKind,
    replyTemplateFingerprint: normalizeReplyText(payload.replyTemplateFingerprint) || buildReplyTemplateFingerprint(replyText),
    priorContextUsed: payload.priorContextUsed === true,
    followupResolvedFromHistory: payload.followupResolvedFromHistory === true,
    continuationReason: normalizeReplyText(payload.continuationReason).toLowerCase() || null,
    knowledgeCandidateCountBySource,
    knowledgeCandidateUsed: payload.knowledgeCandidateUsed === true,
    knowledgeCandidateRejectedReason: normalizeReplyText(payload.knowledgeCandidateRejectedReason).toLowerCase() || null,
    knowledgeRejectedReasons: normalizeReasonList(payload.knowledgeRejectedReasons, 8),
    cityPackCandidateAvailable: payload.cityPackCandidateAvailable === true,
    cityPackRejectedReason: normalizeReplyText(payload.cityPackRejectedReason).toLowerCase() || null,
    cityPackUsedInAnswer: payload.cityPackUsedInAnswer === true,
    savedFaqCandidateAvailable: payload.savedFaqCandidateAvailable === true,
    savedFaqRejectedReason: normalizeReplyText(payload.savedFaqRejectedReason).toLowerCase() || null,
    savedFaqUsedInAnswer: payload.savedFaqUsedInAnswer === true,
    sourceReadinessDecisionSource: normalizeReplyText(payload.sourceReadinessDecisionSource).toLowerCase() || null,
    knowledgeGroundingKind: normalizeReplyText(payload.knowledgeGroundingKind).toLowerCase() || null,
    groundedCandidateAvailable: payload.groundedCandidateAvailable === true,
    structuredCandidateAvailable: payload.structuredCandidateAvailable === true,
    continuationCandidateAvailable: payload.continuationCandidateAvailable === true,
    genericFallbackSlice
  };
}

function resolveTranscriptSnapshotAssistantReplyText(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const qualityMeta = payload.qualityMeta && typeof payload.qualityMeta === 'object'
    ? payload.qualityMeta
    : {};
  const responseContractConformance = payload.responseContractConformance
    && typeof payload.responseContractConformance === 'object'
    ? payload.responseContractConformance
    : {};
  const candidates = [
    payload.finalReplyText,
    payload.replyText,
    qualityMeta.replyTextLineage,
    responseContractConformance.responseMarkdown
  ];
  for (const candidate of candidates) {
    const normalized = normalizeReplyText(candidate);
    if (normalized) return normalized;
  }
  return '';
}

function buildSemanticQuickReplies(params) {
  const payload = params && typeof params === 'object' ? params : {};
  if (Array.isArray(payload.quickReplies)) return payload.quickReplies;
  const conversationMode = normalizeReplyText(payload.conversationMode).toLowerCase();
  if (payload.disableAutoQuickReplies === true || conversationMode === 'concierge') {
    return [];
  }
  const nextSteps = Array.isArray(payload.nextSteps) ? payload.nextSteps : [];
  const out = [];
  nextSteps.slice(0, 3).forEach((step) => {
    const text = normalizeReplyText(step).slice(0, 60);
    if (!text) return;
    out.push({
      label: text.slice(0, 20),
      text
    });
  });
  const followupQuestion = normalizeReplyText(payload.followupQuestion).slice(0, 60);
  if (followupQuestion && out.length < 4) {
    out.push({
      label: 'もう少し相談',
      text: followupQuestion
    });
  }
  return out;
}

function buildSemanticUUnits(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const explicit = Array.isArray(payload.uUnits) ? payload.uUnits : [];
  const defaults = ['U-16', 'U-17', 'U-26', 'U-27'];
  const out = [];
  explicit.concat(defaults).forEach((item) => {
    const normalized = normalizeReplyText(item).slice(0, 32);
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function resolveSemanticGroupPrivacyPolicy(params) {
  const payload = params && typeof params === 'object' ? params : {};
  if (payload.groupPrivacyPolicy && typeof payload.groupPrivacyPolicy === 'object') {
    return payload.groupPrivacyPolicy;
  }
  if (payload.eventSource && typeof payload.eventSource === 'object') {
    return resolveGroupPrivacyPolicy({ source: payload.eventSource });
  }
  return resolveGroupPrivacyPolicy({ source: { type: 'user' } });
}

function resolveSemanticCitationSummary(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const readinessDecision = normalizeReplyText(payload.readinessDecision || payload.sourceReadinessDecision).toLowerCase() || 'unknown';
  const freshnessScore = Number.isFinite(Number(payload.sourceFreshnessScore)) ? Number(payload.sourceFreshnessScore) : null;
  const authorityScore = Number.isFinite(Number(payload.sourceAuthorityScore)) ? Number(payload.sourceAuthorityScore) : null;
  const officialOnlySatisfied = payload.officialOnlySatisfied === true;
  let freshnessStatus = 'unknown';
  if (freshnessScore !== null) {
    freshnessStatus = freshnessScore >= 0.8 ? 'fresh' : (freshnessScore >= 0.5 ? 'mixed' : 'stale');
  }
  const authoritySatisfied = authorityScore === null
    ? null
    : (authorityScore >= 0.75 && (officialOnlySatisfied || payload.officialOnlyRequired === false));
  const disclaimerRequired = ['hedged', 'clarify', 'refuse'].includes(readinessDecision)
    || freshnessStatus !== 'fresh'
    || authoritySatisfied === false
    || payload.regulatedLane === true
    || payload.highUncertainty === true;
  return {
    finalized: true,
    readiness_decision: ['allow', 'hedged', 'clarify', 'refuse'].includes(readinessDecision) ? readinessDecision : 'unknown',
    freshness_status: freshnessStatus,
    authority_satisfied: authoritySatisfied,
    disclaimer_required: disclaimerRequired
  };
}

function resolveSemanticPolicyTrace(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const legalSnapshot = payload.legalSnapshot && typeof payload.legalSnapshot === 'object'
    ? payload.legalSnapshot
    : {};
  const reasonCodes = [];
  if (Array.isArray(legalSnapshot.legalReasonCodes)) {
    legalSnapshot.legalReasonCodes.forEach((item) => {
      const normalized = normalizeReplyText(item).toLowerCase();
      if (normalized && !reasonCodes.includes(normalized)) reasonCodes.push(normalized);
    });
  }
  if (Array.isArray(payload.readinessReasonCodes)) {
    payload.readinessReasonCodes.forEach((item) => {
      const normalized = normalizeReplyText(item).toLowerCase();
      if (normalized && !reasonCodes.includes(normalized)) reasonCodes.push(normalized);
    });
  }
  if (payload.groupPrivacyMode === 'group_safe' && !reasonCodes.includes('group_privacy_guard_active')) {
    reasonCodes.push('group_privacy_guard_active');
  }
  return {
    policy_source: normalizeReplyText(payload.policySource || legalSnapshot.policySource).toLowerCase() || 'system_flags',
    legal_decision: normalizeReplyText(payload.legalDecision || legalSnapshot.legalDecision).toLowerCase() || 'allow',
    safety_gate: normalizeReplyText(payload.safetyGate || payload.readinessDecision || payload.sourceReadinessDecision).toLowerCase() || 'default',
    disclosure_required: payload.disclosureRequired === true,
    escalation_required: payload.escalationRequired === true || ['REQUIRED', 'IN_PROGRESS'].includes(normalizeReplyText(payload.handoffState).toUpperCase()),
    reason_codes: reasonCodes.slice(0, 8)
  };
}

function resolveSemanticWarnings(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const out = [];
  const sourceWarnings = Array.isArray(payload.warnings) ? payload.warnings : [];
  sourceWarnings.forEach((item) => {
    const normalized = normalizeReplyText(item);
    if (normalized && !out.includes(normalized)) out.push(normalized);
  });
  if (payload.groupPrivacyMode === 'group_safe' && !out.includes('group_privacy_guard_active')) {
    out.push('group_privacy_guard_active');
  }
  if (payload.citationSummary && payload.citationSummary.disclaimer_required === true && !out.includes('citation_disclaimer_required')) {
    out.push('citation_disclaimer_required');
  }
  if (payload.policyTrace && payload.policyTrace.escalation_required === true && !out.includes('human_handoff_recommended')) {
    out.push('human_handoff_recommended');
  }
  return out.slice(0, 6);
}

function resolveScopedMemoryPaths(explicitScopes, groupPrivacyPolicy, blockedScope) {
  const scopes = Array.isArray(explicitScopes) ? explicitScopes : [];
  const blocked = typeof blockedScope === 'string' ? blockedScope : '';
  const out = [];
  scopes.forEach((scope) => {
    const normalized = normalizeReplyText(scope);
    if (!normalized) return;
    if (groupPrivacyPolicy && groupPrivacyPolicy.isGroup === true && normalized === blocked) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function buildSemanticReplyEnvelope(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const nextSteps = Array.isArray(payload.nextSteps) ? payload.nextSteps : [];
  const followupQuestion = typeof payload.followupQuestion === 'string'
    ? payload.followupQuestion
    : null;
  const groupPrivacyPolicy = resolveSemanticGroupPrivacyPolicy({
    groupPrivacyPolicy: payload.groupPrivacyPolicy,
    eventSource: payload.eventSource
  });
  const groupPrivacyMode = groupPrivacyPolicy && groupPrivacyPolicy.isGroup === true ? 'group_safe' : 'direct';
  const quickReplies = buildSemanticQuickReplies({
    quickReplies: payload.quickReplies,
    nextSteps,
    followupQuestion,
    conversationMode: payload.conversationMode,
    disableAutoQuickReplies: payload.disableAutoQuickReplies === true
  });
  const citationSummary = resolveSemanticCitationSummary({
    readinessDecision: payload.readinessDecision,
    sourceReadinessDecision: payload.sourceReadinessDecision,
    sourceFreshnessScore: payload.sourceFreshnessScore,
    sourceAuthorityScore: payload.sourceAuthorityScore,
    officialOnlySatisfied: payload.officialOnlySatisfied === true,
    officialOnlyRequired: payload.officialOnlyRequired === true,
    regulatedLane: payload.regulatedLane === true,
    highUncertainty: payload.highUncertainty === true
  });
  const policyTrace = resolveSemanticPolicyTrace({
    legalSnapshot: payload.legalSnapshot,
    legalDecision: payload.legalDecision,
    policySource: payload.policySource,
    readinessDecision: payload.readinessDecision,
    sourceReadinessDecision: payload.sourceReadinessDecision,
    handoffState: payload.handoffState,
    disclosureRequired: citationSummary.disclaimer_required === true,
    escalationRequired: payload.escalationRequired === true,
    groupPrivacyMode
  });
  const warnings = resolveSemanticWarnings({
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    groupPrivacyMode,
    citationSummary,
    policyTrace
  });
  const surfacePlan = resolveLineSurfacePlan({
    requestedSurface: payload.serviceSurface,
    text: payload.replyText || '',
    quickReplies,
    handoffRequired: payload.handoffRequired === true
      || ['OFFERED', 'REQUIRED', 'IN_PROGRESS'].includes(normalizeReplyText(payload.handoffState).toUpperCase()),
    miniAppUrl: payload.miniAppUrl,
    liffUrl: payload.liffUrl
  });
  const responseContractConformance = evaluateResponseContractConformance({
    replyText: payload.replyText || '',
    domainIntent: normalizeDomainIntent(payload.domainIntent || 'general'),
    stage: payload.stage || payload.lifecycleStage || null,
    answerMode: payload.answerMode || payload.conversationMode || null,
    actionClass: payload.actionClass || null,
    confidenceBand: payload.confidenceBand || null,
    tasks: Array.isArray(payload.tasks) ? payload.tasks : [],
    warnings,
    evidenceRefs: Array.isArray(payload.evidenceRefs) ? payload.evidenceRefs : [],
    memoryReadScopes: resolveScopedMemoryPaths(
      payload.memoryReadScopes,
      groupPrivacyPolicy,
      'profile_memory'
    ),
    memoryWriteScopes: resolveScopedMemoryPaths(
      payload.memoryWriteScopes,
      groupPrivacyPolicy,
      'profile_memory'
    ),
    handoffState: payload.handoffState || (payload.handoffRequired === true ? 'OFFERED' : 'NONE'),
    serviceSurface: surfacePlan.surface,
    quickReplies: surfacePlan.quickReplies,
    pathType: payload.pathType || 'slow',
    uUnits: buildSemanticUUnits({ uUnits: payload.uUnits }),
    groupPrivacyMode,
    policyTrace,
    citationSummary,
    conversationMode: typeof payload.conversationMode === 'string'
      ? payload.conversationMode
      : null,
    nextSteps,
    followupQuestion
  });
  const lineRender = buildSemanticLineMessage({
    semanticResponseObject: responseContractConformance.semanticResponseObject,
    miniAppUrl: payload.miniAppUrl,
    liffUrl: payload.liffUrl
  });
  const conformedReplyText = normalizeReplyText(responseContractConformance.responseMarkdown || payload.replyText || '');
  return {
    replyText: conformedReplyText || '回答を準備しています。対象手続きを1つ教えてください。',
    responseContractConformance,
    semanticResponseObject: responseContractConformance.semanticResponseObject,
    lineMessage: lineRender.message,
    lineSurfacePlan: lineRender.surfacePlan
  };
}

function resolveAnswerReadinessTelemetry(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const hasMetric = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));
  const contradictionFlags = Array.isArray(payload.contradictionFlags) ? payload.contradictionFlags : [];
  const contradictionDetected = payload.contradictionDetected === true || contradictionFlags.length > 0;
  const unsupportedClaimCount = Number.isFinite(Number(payload.unsupportedClaimCount))
    ? Math.max(0, Math.floor(Number(payload.unsupportedClaimCount)))
    : contradictionFlags.filter((item) => typeof item === 'string' && item.toLowerCase().includes('unsupported')).length;
  const evidenceCoverage = payload.assistantQuality && Number.isFinite(Number(payload.assistantQuality.evidenceCoverage))
    ? Number(payload.assistantQuality.evidenceCoverage)
    : 0;
  const sourceAuthorityScore = hasMetric(payload.sourceAuthorityScore)
    ? Number(payload.sourceAuthorityScore)
    : evidenceCoverage;
  const sourceFreshnessScore = hasMetric(payload.sourceFreshnessScore)
    ? Number(payload.sourceFreshnessScore)
    : evidenceCoverage;
  const readinessGate = runAnswerReadinessGateV2({
    entryType: normalizeReplyText(payload.entryType) || 'webhook',
    lawfulBasis: payload.legalSnapshot && payload.legalSnapshot.lawfulBasis,
    consentVerified: payload.legalSnapshot && payload.legalSnapshot.consentVerified === true,
    crossBorder: payload.legalSnapshot && payload.legalSnapshot.crossBorder === true,
    legalDecision: payload.legalSnapshot && payload.legalSnapshot.legalDecision,
    intentRiskTier: payload.riskSnapshot && payload.riskSnapshot.intentRiskTier,
    sourceAuthorityScore,
    sourceFreshnessScore,
    sourceReadinessDecision: payload.sourceReadinessDecision,
    officialOnlySatisfied: payload.officialOnlySatisfied,
    unsupportedClaimCount,
    contradictionDetected,
    evidenceCoverage,
    fallbackType: payload.fallbackType || null,
    emergencyContext: payload.emergencyContext === true,
    emergencySeverity: payload.emergencySeverity || null,
    emergencyOfficialSourceSatisfied: payload.emergencyOfficialSourceSatisfied === true,
    emergencyOverrideApplied: payload.emergencyOverrideApplied === true,
    emergencyEventId: payload.emergencyEventId || null,
    emergencyRegionKey: payload.emergencyRegionKey || null,
    emergencySourceSnapshot: payload.emergencySourceSnapshot || null,
    journeyContext: payload.journeyContext === true,
    journeyPhase: payload.journeyPhase || null,
    taskBlockerDetected: payload.taskBlockerDetected === true,
    taskBlockerContext: payload.taskBlockerContext === true,
    blockedTask: payload.blockedTask || null,
    taskGraphState: payload.taskGraphState || null,
    nextActionCandidates: payload.nextActionCandidates,
    nextActions: payload.nextActions,
    journeyAlignedAction: typeof payload.journeyAlignedAction === 'boolean' ? payload.journeyAlignedAction : true,
    cityPackContext: payload.cityPackContext === true,
    cityPackGrounded: payload.cityPackGrounded === true,
    cityPackGroundingReason: payload.cityPackGroundingReason || null,
    cityPackFreshnessScore: payload.cityPackFreshnessScore,
    cityPackAuthorityScore: payload.cityPackAuthorityScore,
    cityPackRequiredSourcesSatisfied: payload.cityPackRequiredSourcesSatisfied,
    cityPackSourceSnapshot: payload.cityPackSourceSnapshot || null,
    cityPackPackId: payload.cityPackPackId || null,
    cityPackValidation: payload.cityPackValidation || null,
    savedFaqContext: payload.savedFaqContext === true || payload.savedFaqReused === true,
    savedFaqReused: payload.savedFaqReused === true,
    savedFaqReusePass: payload.savedFaqReusePass === true,
    savedFaqValid: typeof payload.savedFaqValid === 'boolean' ? payload.savedFaqValid : undefined,
    savedFaqAllowedIntent: typeof payload.savedFaqAllowedIntent === 'boolean' ? payload.savedFaqAllowedIntent : undefined,
    savedFaqAuthorityScore: payload.savedFaqAuthorityScore,
    savedFaqReuseReasonCodes: payload.savedFaqReuseReasonCodes,
    sourceSnapshotRefs: payload.sourceSnapshotRefs,
    crossSystemConflictDetected: payload.crossSystemConflictDetected === true
  });
  const explicitDecision = normalizeReplyText(payload.readinessDecision).toLowerCase();
  const hasExplicitDecision = explicitDecision === 'allow'
    || explicitDecision === 'hedged'
    || explicitDecision === 'clarify'
    || explicitDecision === 'refuse';
  const explicitReasonCodes = Array.isArray(payload.readinessReasonCodes)
    ? payload.readinessReasonCodes
      .map((item) => normalizeReplyText(item).toLowerCase().replace(/\s+/g, '_'))
      .filter(Boolean)
      .slice(0, 12)
    : [];
  const explicitSafeResponseMode = normalizeReplyText(payload.readinessSafeResponseMode).toLowerCase();
  const readiness = hasExplicitDecision
    ? Object.assign({}, readinessGate.readiness, {
      decision: explicitDecision,
      reasonCodes: explicitReasonCodes.length ? explicitReasonCodes : readinessGate.readiness.reasonCodes,
      safeResponseMode: explicitSafeResponseMode || readinessGate.readiness.safeResponseMode
    })
    : readinessGate.readiness;
  if (!hasExplicitDecision) {
    const legalBlocked = payload.legalSnapshot && payload.legalSnapshot.legalDecision === 'blocked';
    const sourceSignalPresent = hasMetric(payload.sourceAuthorityScore)
      || hasMetric(payload.sourceFreshnessScore)
      || normalizeReplyText(payload.sourceReadinessDecision).length > 0;
    const riskTier = payload.riskSnapshot && typeof payload.riskSnapshot.intentRiskTier === 'string'
      ? payload.riskSnapshot.intentRiskTier.toLowerCase()
      : 'low';
    if (!legalBlocked && !sourceSignalPresent && !contradictionDetected && unsupportedClaimCount === 0 && riskTier !== 'high') {
      readiness.decision = 'allow';
      readiness.safeResponseMode = 'answer';
      readiness.reasonCodes = ['readiness_signal_missing_allow'];
    }
  }
  const telemetryCoverageSignals = resolveTelemetryCoverageSignals(Object.assign({}, payload, {
    evidenceCoverage,
    unsupportedClaimCount,
    contradictionDetected,
    sourceAuthorityScore,
    sourceFreshnessScore,
    sourceReadinessDecision: payload.sourceReadinessDecision,
    sourceReadinessReasons: payload.sourceReadinessReasons,
    officialOnlySatisfied: payload.officialOnlySatisfied === true,
    emergencyOfficialSourceSatisfied: payload.emergencyOfficialSourceSatisfied === true,
    emergencyOverrideApplied: payload.emergencyOverrideApplied === true,
    journeyAlignedAction: typeof payload.journeyAlignedAction === 'boolean' ? payload.journeyAlignedAction : true,
    cityPackGrounded: payload.cityPackGrounded === true,
    savedFaqReusePass: payload.savedFaqReusePass === true,
    savedFaqReused: payload.savedFaqReused === true,
    sourceSnapshotRefs: payload.sourceSnapshotRefs
  }));
  return {
    readiness,
    readinessV2: readinessGate.readinessV2,
    answerReadinessVersion: readinessGate.answerReadinessVersion,
    answerReadinessLogOnlyV2: readinessGate.answerReadinessLogOnlyV2,
    answerReadinessEnforcedV2: readinessGate.answerReadinessEnforcedV2,
    answerReadinessV2Mode: readinessGate.mode ? readinessGate.mode.mode : null,
    answerReadinessV2Stage: readinessGate.mode ? readinessGate.mode.stage : null,
    answerReadinessV2EnforcementReason: readinessGate.mode ? readinessGate.mode.enforcementReason : null,
    readinessTelemetryV2: Object.assign({}, readinessGate.telemetry || {}, telemetryCoverageSignals),
    unsupportedClaimCount,
    contradictionDetected
  };
}

function resolveSemanticTraceTelemetry(responseContractConformance) {
  const conformance = responseContractConformance && typeof responseContractConformance === 'object'
    ? responseContractConformance
    : {};
  const semantic = conformance.semanticResponseObject && typeof conformance.semanticResponseObject === 'object'
    ? conformance.semanticResponseObject
    : {};
  const citationSummary = semantic.citation_summary && typeof semantic.citation_summary === 'object'
    ? semantic.citation_summary
    : {};
  const policyTrace = semantic.policy_trace && typeof semantic.policy_trace === 'object'
    ? semantic.policy_trace
    : {};
  return {
    contractVersion: typeof semantic.contract_version === 'string' ? semantic.contract_version : null,
    pathType: typeof semantic.path_type === 'string' ? semantic.path_type : null,
    uUnits: Array.isArray(semantic.u_units) ? semantic.u_units : [],
    serviceSurface: typeof semantic.service_surface === 'string' ? semantic.service_surface : null,
    groupPrivacyMode: typeof semantic.group_privacy_mode === 'string' ? semantic.group_privacy_mode : null,
    handoffState: typeof semantic.handoff_state === 'string' ? semantic.handoff_state : null,
    memoryReadScopes: Array.isArray(semantic.memory_read_scopes) ? semantic.memory_read_scopes : [],
    memoryWriteScopes: Array.isArray(semantic.memory_write_scopes) ? semantic.memory_write_scopes : [],
    citationFinalized: citationSummary.finalized === true,
    citationFreshnessStatus: typeof citationSummary.freshness_status === 'string'
      ? citationSummary.freshness_status
      : null,
    citationAuthoritySatisfied: typeof citationSummary.authority_satisfied === 'boolean'
      ? citationSummary.authority_satisfied
      : null,
    citationDisclaimerRequired: citationSummary.disclaimer_required === true,
    policySourceResolved: typeof policyTrace.policy_source === 'string' ? policyTrace.policy_source : null,
    policyGate: typeof policyTrace.safety_gate === 'string' ? policyTrace.safety_gate : null,
    policyDisclosureRequired: policyTrace.disclosure_required === true,
    policyEscalationRequired: policyTrace.escalation_required === true
  };
}

async function appendLlmGateDecisionBestEffort(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const lineUserId = typeof payload.lineUserId === 'string' ? payload.lineUserId.trim() : '';
  if (!lineUserId) return;
  const qualityMeta = payload.conversationQuality && typeof payload.conversationQuality === 'object'
    ? payload.conversationQuality
    : buildConversationQualityMeta({
      replyText: payload.replyText || '',
      domainIntent: payload.domainIntent || 'general',
      opportunityReasonKeys: payload.opportunityReasonKeys
    });
  const riskSnapshot = resolveIntentRiskTier({
    domainIntent: payload.domainIntent,
    reasonCodes: payload.riskReasonCodes
  });
  const legalSnapshot = payload.legalSnapshot && typeof payload.legalSnapshot === 'object'
    ? resolveLlmLegalPolicySnapshot({ policy: payload.legalSnapshot })
    : await loadLlmLegalPolicySnapshot({
      systemFlagsRepo: { getLlmPolicy }
    });
  const policy = payload.policy && typeof payload.policy === 'object' ? payload.policy : null;
  const conciergeMeta = payload.conciergeMeta && typeof payload.conciergeMeta === 'object' ? payload.conciergeMeta : null;
  const refusalStrategy = resolveRefusalStrategy(policy);
  const policyVersionId = payload.policyVersionId
    || (policy && typeof policy.policy_version_id === 'string' ? policy.policy_version_id : null)
    || null;
  const assistantQuality = normalizeAssistantQuality(payload.assistantQuality, {
    intentResolved: payload.intent || 'faq_search',
    blockedStage: payload.decision === 'allow' ? null : 'route_gate',
    fallbackReason: payload.blockedReason || null
  });
  const sourceAuthorityScore = Number.isFinite(Number(payload.sourceAuthorityScore))
    ? Number(payload.sourceAuthorityScore)
    : (conciergeMeta && Number.isFinite(Number(conciergeMeta.sourceAuthorityScore)) ? Number(conciergeMeta.sourceAuthorityScore) : null);
  const sourceFreshnessScore = Number.isFinite(Number(payload.sourceFreshnessScore))
    ? Number(payload.sourceFreshnessScore)
    : (conciergeMeta && Number.isFinite(Number(conciergeMeta.sourceFreshnessScore)) ? Number(conciergeMeta.sourceFreshnessScore) : null);
  const sourceReadinessDecision = typeof payload.sourceReadinessDecision === 'string'
    ? payload.sourceReadinessDecision
    : (conciergeMeta && typeof conciergeMeta.sourceReadinessDecision === 'string' ? conciergeMeta.sourceReadinessDecision : null);
  const sourceReadinessReasons = Array.isArray(payload.sourceReadinessReasons)
    ? payload.sourceReadinessReasons
    : (conciergeMeta && Array.isArray(conciergeMeta.sourceReadinessReasons) ? conciergeMeta.sourceReadinessReasons : []);
  const officialOnlySatisfied = payload.officialOnlySatisfied === true
    || (conciergeMeta && conciergeMeta.officialOnlySatisfied === true);
  const answerReadinessLogOnly = typeof payload.answerReadinessLogOnly === 'boolean'
    ? payload.answerReadinessLogOnly
    : false;
  const readinessTelemetry = resolveAnswerReadinessTelemetry({
    legalSnapshot,
    riskSnapshot,
    sourceAuthorityScore,
    sourceFreshnessScore,
    sourceReadinessDecision,
    officialOnlySatisfied,
    assistantQuality,
    fallbackType: assistantQuality && assistantQuality.fallbackReason ? assistantQuality.fallbackReason : payload.blockedReason,
    contradictionFlags: payload.contradictionFlags,
    unsupportedClaimCount: payload.unsupportedClaimCount,
    contradictionDetected: payload.contradictionDetected === true
  });
  const responseContractConformance = payload.responseContractConformance
    && typeof payload.responseContractConformance === 'object'
    ? payload.responseContractConformance
    : evaluateResponseContractConformance({
      replyText: payload.replyText || payload.finalReplyText || '',
      domainIntent: normalizeDomainIntent(payload.domainIntent || qualityMeta.domainIntent || 'general'),
      conversationMode: typeof payload.conversationMode === 'string'
        ? payload.conversationMode
        : null,
      nextSteps: Array.isArray(payload.committedNextActions) ? payload.committedNextActions : [],
      followupQuestion: typeof payload.committedFollowupQuestion === 'string'
        ? payload.committedFollowupQuestion
        : null
    });
  const semanticTrace = resolveSemanticTraceTelemetry(responseContractConformance);
  const routeCoverageMeta = resolveRouteCoverageMeta({
    entryType: 'webhook',
    routeKind: payload.routeKind || 'canonical',
    routerReason: payload.routerReason,
    fallbackType: typeof payload.fallbackType === 'string' && payload.fallbackType.trim()
      ? payload.fallbackType
      : (qualityMeta.fallbackType || payload.blockedReason || null),
    compatFallbackReason: payload.compatFallbackReason,
    sharedReadinessBridge: payload.sharedReadinessBridge || 'webhook_direct_readiness',
    routeDecisionSource: payload.routeDecisionSource
      || (typeof payload.routerReason === 'string' && payload.routerReason.trim() ? 'conversation_router' : 'webhook_route')
  });
  try {
    await appendLlmGateDecision({
      actor: 'line_webhook',
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
        refusalMode: refusalStrategy.mode,
        userTier: conciergeMeta && conciergeMeta.userTier ? conciergeMeta.userTier : (payload.plan === 'pro' ? 'paid' : 'free'),
        mode: conciergeMeta && conciergeMeta.mode ? conciergeMeta.mode : null,
        topic: conciergeMeta && conciergeMeta.topic ? conciergeMeta.topic : null,
        citationRanks: conciergeMeta && Array.isArray(conciergeMeta.citationRanks) ? conciergeMeta.citationRanks : [],
        urlCount: conciergeMeta && Number.isFinite(Number(conciergeMeta.urlCount)) ? Number(conciergeMeta.urlCount) : 0,
        urls: conciergeMeta && Array.isArray(conciergeMeta.urls) ? conciergeMeta.urls : [],
        guardDecisions: conciergeMeta && Array.isArray(conciergeMeta.guardDecisions) ? conciergeMeta.guardDecisions : [],
        blockedReasons: conciergeMeta && Array.isArray(conciergeMeta.blockedReasons) ? conciergeMeta.blockedReasons : [],
        injectionFindings: conciergeMeta ? conciergeMeta.injectionFindings === true : false,
        conversationState: conciergeMeta && typeof conciergeMeta.conversationState === 'string'
          ? conciergeMeta.conversationState
          : null,
        conversationMove: conciergeMeta && typeof conciergeMeta.conversationMove === 'string'
          ? conciergeMeta.conversationMove
          : null,
        styleId: conciergeMeta && typeof conciergeMeta.styleId === 'string' ? conciergeMeta.styleId : null,
        conversationPattern: conciergeMeta && typeof conciergeMeta.conversationPattern === 'string' ? conciergeMeta.conversationPattern : null,
        responseLength: conciergeMeta && Number.isFinite(Number(conciergeMeta.responseLength))
          ? Number(conciergeMeta.responseLength)
          : 0,
        intentConfidence: conciergeMeta && Number.isFinite(Number(conciergeMeta.intentConfidence))
          ? Number(conciergeMeta.intentConfidence)
          : 0,
        contextConfidence: conciergeMeta && Number.isFinite(Number(conciergeMeta.contextConfidence))
          ? Number(conciergeMeta.contextConfidence)
          : 0,
        evidenceNeed: conciergeMeta && typeof conciergeMeta.evidenceNeed === 'string'
          ? conciergeMeta.evidenceNeed
          : 'none',
        evidenceOutcome: conciergeMeta && typeof conciergeMeta.evidenceOutcome === 'string'
          ? conciergeMeta.evidenceOutcome
          : 'SUPPORTED',
        chosenAction: conciergeMeta && conciergeMeta.chosenAction && typeof conciergeMeta.chosenAction === 'object'
          ? conciergeMeta.chosenAction
          : null,
        contextVersion: conciergeMeta && typeof conciergeMeta.contextVersion === 'string'
          ? conciergeMeta.contextVersion
          : null,
        featureHash: conciergeMeta && typeof conciergeMeta.featureHash === 'string'
          ? conciergeMeta.featureHash
          : null,
        postRenderLint: conciergeMeta && conciergeMeta.postRenderLint && typeof conciergeMeta.postRenderLint === 'object'
          ? conciergeMeta.postRenderLint
          : { findings: [], modified: false },
        contextSignature: conciergeMeta && typeof conciergeMeta.contextSignature === 'string'
          ? conciergeMeta.contextSignature
          : null,
        contextualBanditEnabled: conciergeMeta ? conciergeMeta.contextualBanditEnabled === true : false,
        contextualFeatures: conciergeMeta && conciergeMeta.contextualFeatures && typeof conciergeMeta.contextualFeatures === 'object'
          ? conciergeMeta.contextualFeatures
          : null,
        counterfactualSelectedArmId: conciergeMeta && typeof conciergeMeta.counterfactualSelectedArmId === 'string'
          ? conciergeMeta.counterfactualSelectedArmId
          : null,
        counterfactualSelectedRank: conciergeMeta && Number.isFinite(Number(conciergeMeta.counterfactualSelectedRank))
          ? Number(conciergeMeta.counterfactualSelectedRank)
          : null,
        counterfactualTopArms: conciergeMeta && Array.isArray(conciergeMeta.counterfactualTopArms)
          ? conciergeMeta.counterfactualTopArms
          : [],
        counterfactualEval: conciergeMeta && conciergeMeta.counterfactualEval && typeof conciergeMeta.counterfactualEval === 'object'
          ? conciergeMeta.counterfactualEval
          : null,
        assistantQuality,
        routeKind: routeCoverageMeta.routeKind,
        conversationMode: typeof payload.conversationMode === 'string' && payload.conversationMode.trim()
          ? payload.conversationMode.trim().toLowerCase()
          : null,
        routerReason: routeCoverageMeta.routerReason,
        routerReasonObserved: routeCoverageMeta.routerReasonObserved,
        compatFallbackReason: routeCoverageMeta.compatFallbackReason,
        sharedReadinessBridge: routeCoverageMeta.sharedReadinessBridge,
        sharedReadinessBridgeObserved: routeCoverageMeta.sharedReadinessBridgeObserved,
        routeDecisionSource: routeCoverageMeta.routeDecisionSource,
        opportunityType: typeof payload.opportunityType === 'string' && payload.opportunityType.trim()
          ? payload.opportunityType.trim().toLowerCase()
          : 'none',
        opportunityReasonKeys: Array.isArray(payload.opportunityReasonKeys)
          ? payload.opportunityReasonKeys
            .map((item) => (typeof item === 'string' ? item.trim().toLowerCase().replace(/\s+/g, '_') : ''))
            .filter(Boolean)
            .slice(0, 8)
          : [],
        interventionBudget: Number.isFinite(Number(payload.interventionBudget))
          ? (Number(payload.interventionBudget) >= 1 ? 1 : 0)
          : 0,
        lawfulBasis: legalSnapshot.lawfulBasis,
        consentVerified: legalSnapshot.consentVerified,
        crossBorder: legalSnapshot.crossBorder,
        legalDecision: legalSnapshot.legalDecision,
        legalReasonCodes: Array.isArray(legalSnapshot.legalReasonCodes) ? legalSnapshot.legalReasonCodes : [],
        intentRiskTier: riskSnapshot.intentRiskTier,
        riskReasonCodes: riskSnapshot.riskReasonCodes,
        sourceAuthorityScore,
        sourceFreshnessScore,
        sourceReadinessDecision,
        sourceReadinessReasons,
        evidenceCoverage: Number.isFinite(Number(readinessTelemetry.readinessTelemetryV2.evidenceCoverage))
          ? Number(readinessTelemetry.readinessTelemetryV2.evidenceCoverage)
          : null,
        evidenceCoverageObserved: readinessTelemetry.readinessTelemetryV2.evidenceCoverageObserved === true
          ? true
          : (readinessTelemetry.readinessTelemetryV2.evidenceCoverageObserved === false ? false : null),
        officialOnlySatisfied,
        officialOnlySatisfiedObserved: readinessTelemetry.readinessTelemetryV2.officialOnlySatisfiedObserved === true
          ? true
          : (readinessTelemetry.readinessTelemetryV2.officialOnlySatisfiedObserved === false ? false : null),
        readinessDecision: readinessTelemetry.readiness.decision,
        readinessReasonCodes: readinessTelemetry.readiness.reasonCodes,
        readinessSafeResponseMode: readinessTelemetry.readiness.safeResponseMode,
        answerReadinessVersion: readinessTelemetry.answerReadinessVersion,
        answerReadinessLogOnlyV2: readinessTelemetry.answerReadinessLogOnlyV2 === true,
        answerReadinessEnforcedV2: readinessTelemetry.answerReadinessEnforcedV2 === true,
        answerReadinessV2Mode: readinessTelemetry.answerReadinessV2Mode || null,
        answerReadinessV2Stage: readinessTelemetry.answerReadinessV2Stage || null,
        answerReadinessV2EnforcementReason: readinessTelemetry.answerReadinessV2EnforcementReason || null,
        readinessDecisionSource: readinessTelemetry.readiness.decisionSource || null,
        readinessDecisionSourceV2: readinessTelemetry.readinessV2.decisionSource || null,
        readinessHardeningVersion: readinessTelemetry.readinessTelemetryV2.readinessHardeningVersion || null,
        readinessDecisionV2: readinessTelemetry.readinessV2.decision,
        readinessReasonCodesV2: readinessTelemetry.readinessV2.reasonCodes,
        readinessSafeResponseModeV2: readinessTelemetry.readinessV2.safeResponseMode,
        emergencyContextActive: readinessTelemetry.readinessTelemetryV2.emergencyContextActive === true,
        emergencyOfficialSourceSatisfied: readinessTelemetry.readinessTelemetryV2.emergencyOfficialSourceSatisfied === true,
        emergencyOfficialSourceSatisfiedObserved: readinessTelemetry.readinessTelemetryV2.emergencyOfficialSourceSatisfiedObserved === true
          ? true
          : (readinessTelemetry.readinessTelemetryV2.emergencyOfficialSourceSatisfiedObserved === false ? false : null),
        journeyPhase: readinessTelemetry.readinessTelemetryV2.journeyPhase || null,
        taskBlockerDetected: readinessTelemetry.readinessTelemetryV2.taskBlockerDetected === true,
        journeyAlignedAction: typeof readinessTelemetry.readinessTelemetryV2.journeyAlignedAction === 'boolean'
          ? readinessTelemetry.readinessTelemetryV2.journeyAlignedAction
          : true,
        journeyAlignedActionObserved: readinessTelemetry.readinessTelemetryV2.journeyAlignedActionObserved === true
          ? true
          : (readinessTelemetry.readinessTelemetryV2.journeyAlignedActionObserved === false ? false : null),
        cityPackGrounded: readinessTelemetry.readinessTelemetryV2.cityPackGrounded === true,
        cityPackGroundedObserved: readinessTelemetry.readinessTelemetryV2.cityPackGroundedObserved === true
          ? true
          : (readinessTelemetry.readinessTelemetryV2.cityPackGroundedObserved === false ? false : null),
        cityPackFreshnessScore: Number.isFinite(Number(readinessTelemetry.readinessTelemetryV2.cityPackFreshnessScore))
          ? Number(readinessTelemetry.readinessTelemetryV2.cityPackFreshnessScore)
          : null,
        cityPackAuthorityScore: Number.isFinite(Number(readinessTelemetry.readinessTelemetryV2.cityPackAuthorityScore))
          ? Number(readinessTelemetry.readinessTelemetryV2.cityPackAuthorityScore)
          : null,
        staleSourceBlocked: readinessTelemetry.readinessTelemetryV2.staleSourceBlocked === true
          ? true
          : (readinessTelemetry.readinessTelemetryV2.staleSourceBlocked === false ? false : null),
        staleSourceBlockedObserved: readinessTelemetry.readinessTelemetryV2.staleSourceBlockedObserved === true
          ? true
          : (readinessTelemetry.readinessTelemetryV2.staleSourceBlockedObserved === false ? false : null),
        savedFaqReused: readinessTelemetry.readinessTelemetryV2.savedFaqReused === true,
        savedFaqReusePass: readinessTelemetry.readinessTelemetryV2.savedFaqReusePass === true,
        savedFaqReusePassObserved: readinessTelemetry.readinessTelemetryV2.savedFaqReusePassObserved === true
          ? true
          : (readinessTelemetry.readinessTelemetryV2.savedFaqReusePassObserved === false ? false : null),
        savedFaqReuseReasonCodes: Array.isArray(payload.savedFaqReuseReasonCodes)
          ? payload.savedFaqReuseReasonCodes
          : [],
        savedFaqValid: typeof readinessTelemetry.readinessTelemetryV2.savedFaqValid === 'boolean'
          ? readinessTelemetry.readinessTelemetryV2.savedFaqValid
          : null,
        savedFaqAllowedIntent: typeof readinessTelemetry.readinessTelemetryV2.savedFaqAllowedIntent === 'boolean'
          ? readinessTelemetry.readinessTelemetryV2.savedFaqAllowedIntent
          : null,
        savedFaqAuthorityScore: Number.isFinite(Number(readinessTelemetry.readinessTelemetryV2.savedFaqAuthorityScore))
          ? Number(readinessTelemetry.readinessTelemetryV2.savedFaqAuthorityScore)
          : null,
        sourceSnapshotRefs: Array.isArray(readinessTelemetry.readinessTelemetryV2.sourceSnapshotRefs)
          ? readinessTelemetry.readinessTelemetryV2.sourceSnapshotRefs
          : [],
        crossSystemConflictDetected: readinessTelemetry.readinessTelemetryV2.crossSystemConflictDetected === true,
        unsupportedClaimCount: readinessTelemetry.unsupportedClaimCount,
        contradictionDetected: readinessTelemetry.contradictionDetected,
        answerReadinessLogOnly,
        orchestratorPathUsed: payload.orchestratorPathUsed === true,
        contextResumeDomain: typeof payload.contextResumeDomain === 'string' && payload.contextResumeDomain.trim()
          ? payload.contextResumeDomain.trim().toLowerCase()
          : null,
        loopBreakApplied: payload.loopBreakApplied === true,
        followupIntent: typeof payload.followupIntent === 'string' && payload.followupIntent.trim()
          ? payload.followupIntent.trim().toLowerCase()
          : (qualityMeta.followupIntent || null),
        conciseModeApplied: payload.conciseModeApplied === true || qualityMeta.conciseModeApplied === true,
        repetitionPrevented: payload.repetitionPrevented === true || qualityMeta.repetitionPrevented === true,
        directAnswerApplied: payload.directAnswerApplied === true || qualityMeta.directAnswerApplied === true,
        clarifySuppressed: payload.clarifySuppressed === true || qualityMeta.clarifySuppressed === true,
        misunderstandingRecovered: payload.misunderstandingRecovered === true || qualityMeta.misunderstandingRecovered === true,
        contextCarryScore: Number.isFinite(Number(payload.contextCarryScore))
          ? Number(payload.contextCarryScore)
          : Number(qualityMeta.contextCarryScore || 0),
        repeatRiskScore: Number.isFinite(Number(payload.repeatRiskScore))
          ? Number(payload.repeatRiskScore)
          : Number(qualityMeta.repeatRiskScore || 0),
        strategyReason: typeof payload.strategyReason === 'string' && payload.strategyReason.trim()
          ? payload.strategyReason.trim().toLowerCase()
          : (qualityMeta.strategyReason || null),
        strategyAlternativeSet: Array.isArray(payload.strategyAlternativeSet)
          ? payload.strategyAlternativeSet
            .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
            .filter(Boolean)
            .slice(0, 8)
          : (Array.isArray(qualityMeta.strategyAlternativeSet) ? qualityMeta.strategyAlternativeSet : []),
        strategyPriorityVersion: typeof payload.strategyPriorityVersion === 'string' && payload.strategyPriorityVersion.trim()
          ? payload.strategyPriorityVersion.trim()
          : (qualityMeta.strategyPriorityVersion || null),
        fallbackPriorityReason: typeof payload.fallbackPriorityReason === 'string' && payload.fallbackPriorityReason.trim()
          ? payload.fallbackPriorityReason.trim().toLowerCase()
          : (qualityMeta.fallbackPriorityReason || null),
        selectedCandidateKind: typeof payload.selectedCandidateKind === 'string' && payload.selectedCandidateKind.trim()
          ? payload.selectedCandidateKind.trim().toLowerCase()
          : (qualityMeta.selectedCandidateKind || null),
        selectedByDirectAnswerFirst: payload.selectedByDirectAnswerFirst === true || qualityMeta.selectedByDirectAnswerFirst === true,
        retrievalBlockedByStrategy: payload.retrievalBlockedByStrategy === true || qualityMeta.retrievalBlockedByStrategy === true,
        retrievalBlockReason: typeof payload.retrievalBlockReason === 'string' && payload.retrievalBlockReason.trim()
          ? payload.retrievalBlockReason.trim().toLowerCase()
          : (qualityMeta.retrievalBlockReason || null),
        retrievalPermitReason: typeof payload.retrievalPermitReason === 'string' && payload.retrievalPermitReason.trim()
          ? payload.retrievalPermitReason.trim().toLowerCase()
          : (qualityMeta.retrievalPermitReason || null),
        retrievalReenabledBySlice: typeof payload.retrievalReenabledBySlice === 'string' && payload.retrievalReenabledBySlice.trim()
          ? payload.retrievalReenabledBySlice.trim().toLowerCase()
          : (qualityMeta.retrievalReenabledBySlice || null),
        fallbackTemplateKind: typeof payload.fallbackTemplateKind === 'string' && payload.fallbackTemplateKind.trim()
          ? payload.fallbackTemplateKind.trim().toLowerCase()
          : (qualityMeta.fallbackTemplateKind || null),
        finalizerTemplateKind: typeof payload.finalizerTemplateKind === 'string' && payload.finalizerTemplateKind.trim()
          ? payload.finalizerTemplateKind.trim().toLowerCase()
          : (qualityMeta.finalizerTemplateKind || null),
        replyTemplateFingerprint: typeof payload.replyTemplateFingerprint === 'string' && payload.replyTemplateFingerprint.trim()
          ? payload.replyTemplateFingerprint.trim()
          : (qualityMeta.replyTemplateFingerprint || null),
        priorContextUsed: payload.priorContextUsed === true || qualityMeta.priorContextUsed === true,
        followupResolvedFromHistory: payload.followupResolvedFromHistory === true || qualityMeta.followupResolvedFromHistory === true,
        continuationReason: typeof payload.continuationReason === 'string' && payload.continuationReason.trim()
          ? payload.continuationReason.trim().toLowerCase()
          : (qualityMeta.continuationReason || null),
        knowledgeCandidateCountBySource: payload.knowledgeCandidateCountBySource
          && typeof payload.knowledgeCandidateCountBySource === 'object'
          ? Object.assign({}, payload.knowledgeCandidateCountBySource)
          : (qualityMeta.knowledgeCandidateCountBySource && typeof qualityMeta.knowledgeCandidateCountBySource === 'object'
            ? Object.assign({}, qualityMeta.knowledgeCandidateCountBySource)
            : null),
        knowledgeCandidateUsed: payload.knowledgeCandidateUsed === true || qualityMeta.knowledgeCandidateUsed === true,
        knowledgeCandidateRejectedReason: typeof payload.knowledgeCandidateRejectedReason === 'string' && payload.knowledgeCandidateRejectedReason.trim()
          ? payload.knowledgeCandidateRejectedReason.trim().toLowerCase()
          : (qualityMeta.knowledgeCandidateRejectedReason || null),
        knowledgeRejectedReasons: Array.isArray(payload.knowledgeRejectedReasons)
          ? normalizeReasonList(payload.knowledgeRejectedReasons, 8)
          : (Array.isArray(qualityMeta.knowledgeRejectedReasons) ? normalizeReasonList(qualityMeta.knowledgeRejectedReasons, 8) : []),
        cityPackCandidateAvailable: payload.cityPackCandidateAvailable === true || qualityMeta.cityPackCandidateAvailable === true,
        cityPackRejectedReason: typeof payload.cityPackRejectedReason === 'string' && payload.cityPackRejectedReason.trim()
          ? payload.cityPackRejectedReason.trim().toLowerCase()
          : (qualityMeta.cityPackRejectedReason || null),
        cityPackUsedInAnswer: payload.cityPackUsedInAnswer === true || qualityMeta.cityPackUsedInAnswer === true,
        savedFaqCandidateAvailable: payload.savedFaqCandidateAvailable === true || qualityMeta.savedFaqCandidateAvailable === true,
        savedFaqRejectedReason: typeof payload.savedFaqRejectedReason === 'string' && payload.savedFaqRejectedReason.trim()
          ? payload.savedFaqRejectedReason.trim().toLowerCase()
          : (qualityMeta.savedFaqRejectedReason || null),
        savedFaqUsedInAnswer: payload.savedFaqUsedInAnswer === true || qualityMeta.savedFaqUsedInAnswer === true,
        sourceReadinessDecisionSource: typeof payload.sourceReadinessDecisionSource === 'string' && payload.sourceReadinessDecisionSource.trim()
          ? payload.sourceReadinessDecisionSource.trim().toLowerCase()
          : (qualityMeta.sourceReadinessDecisionSource || null),
        knowledgeGroundingKind: typeof payload.knowledgeGroundingKind === 'string' && payload.knowledgeGroundingKind.trim()
          ? payload.knowledgeGroundingKind.trim().toLowerCase()
          : (qualityMeta.knowledgeGroundingKind || null),
        groundedCandidateAvailable: payload.groundedCandidateAvailable === true || qualityMeta.groundedCandidateAvailable === true,
        structuredCandidateAvailable: payload.structuredCandidateAvailable === true || qualityMeta.structuredCandidateAvailable === true,
        continuationCandidateAvailable: payload.continuationCandidateAvailable === true || qualityMeta.continuationCandidateAvailable === true,
        genericFallbackSlice: typeof payload.genericFallbackSlice === 'string' && payload.genericFallbackSlice.trim()
          ? payload.genericFallbackSlice.trim().toLowerCase()
          : (qualityMeta.genericFallbackSlice || null),
        legacyTemplateHit: payload.legacyTemplateHit === true || qualityMeta.legacyTemplateHit === true,
        followupQuestionIncluded: payload.followupQuestionIncluded === true || qualityMeta.followupQuestionIncluded === true,
        actionCount: Number.isFinite(Number(payload.actionCount))
          ? Number(payload.actionCount)
          : Number(qualityMeta.actionCount || 0),
        pitfallIncluded: payload.pitfallIncluded === true || qualityMeta.pitfallIncluded === true,
        parentIntentType: typeof payload.parentIntentType === 'string' && payload.parentIntentType.trim()
          ? payload.parentIntentType.trim().toUpperCase()
          : null,
        parentAnswerMode: typeof payload.parentAnswerMode === 'string' && payload.parentAnswerMode.trim()
          ? payload.parentAnswerMode.trim().toUpperCase()
          : null,
        parentLifecycleStage: typeof payload.parentLifecycleStage === 'string' && payload.parentLifecycleStage.trim()
          ? payload.parentLifecycleStage.trim().toUpperCase()
          : null,
        parentChapter: typeof payload.parentChapter === 'string' && payload.parentChapter.trim()
          ? payload.parentChapter.trim().toUpperCase()
          : null,
        parentRoutingInvariantStatus: typeof payload.parentRoutingInvariantStatus === 'string'
          ? payload.parentRoutingInvariantStatus.trim().toLowerCase()
          : null,
        parentRoutingInvariantErrors: Array.isArray(payload.parentRoutingInvariantErrors)
          ? payload.parentRoutingInvariantErrors
            .map((item) => (typeof item === 'string' ? item.trim().toLowerCase().replace(/\s+/g, '_') : ''))
            .filter(Boolean)
            .slice(0, 8)
          : [],
        requiredCoreFactsComplete: payload.requiredCoreFactsComplete === true,
        missingRequiredCoreFacts: Array.isArray(payload.missingRequiredCoreFacts)
          ? payload.missingRequiredCoreFacts
            .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
            .filter(Boolean)
            .slice(0, 12)
          : [],
        missingRequiredCoreFactsCount: Number.isFinite(Number(payload.missingRequiredCoreFactsCount))
          ? Number(payload.missingRequiredCoreFactsCount)
          : 0,
        requiredCoreFactsCriticalMissingCount: Number.isFinite(Number(payload.requiredCoreFactsCriticalMissingCount))
          ? Number(payload.requiredCoreFactsCriticalMissingCount)
          : 0,
        requiredCoreFactsGateDecision: typeof payload.requiredCoreFactsGateDecision === 'string' && payload.requiredCoreFactsGateDecision.trim()
          ? payload.requiredCoreFactsGateDecision.trim().toLowerCase()
          : null,
        requiredCoreFactsGateLogOnly: payload.requiredCoreFactsGateLogOnly === true,
        domainIntent: normalizeDomainIntent(payload.domainIntent || qualityMeta.domainIntent || 'general'),
        fallbackType: typeof payload.fallbackType === 'string' && payload.fallbackType.trim()
          ? payload.fallbackType.trim().toLowerCase()
          : (qualityMeta.fallbackType || null),
        interventionSuppressedBy: typeof payload.interventionSuppressedBy === 'string' && payload.interventionSuppressedBy.trim()
          ? payload.interventionSuppressedBy.trim().toLowerCase()
          : (qualityMeta.interventionSuppressedBy || null),
        responseContractConformant: responseContractConformance.conformant === true,
        responseContractErrorCount: Number.isFinite(Number(responseContractConformance.errorCount))
          ? Number(responseContractConformance.errorCount)
          : 0,
        responseContractErrors: Array.isArray(responseContractConformance.errors)
          ? responseContractConformance.errors
          : [],
        responseContractFallbackApplied: responseContractConformance.fallbackApplied === true,
        contractVersion: semanticTrace.contractVersion,
        pathType: semanticTrace.pathType,
        uUnits: semanticTrace.uUnits,
        serviceSurface: semanticTrace.serviceSurface,
        groupPrivacyMode: semanticTrace.groupPrivacyMode,
        handoffState: semanticTrace.handoffState,
        memoryReadScopes: semanticTrace.memoryReadScopes,
        memoryWriteScopes: semanticTrace.memoryWriteScopes,
        citationFinalized: semanticTrace.citationFinalized,
        citationFreshnessStatus: semanticTrace.citationFreshnessStatus,
        citationAuthoritySatisfied: semanticTrace.citationAuthoritySatisfied,
        citationDisclaimerRequired: semanticTrace.citationDisclaimerRequired,
        policySourceResolved: semanticTrace.policySourceResolved,
        policyGate: semanticTrace.policyGate,
        policyDisclosureRequired: semanticTrace.policyDisclosureRequired,
        policyEscalationRequired: semanticTrace.policyEscalationRequired,
        entryType: 'webhook',
        gatesApplied: ['kill_switch', 'injection', 'url_guard']
      }
    });
  } catch (_err) {
    // best effort only
  }
}

async function loadBanditStateByArm(segmentKey) {
  const normalizedSegmentKey = normalizeReplyText(segmentKey);
  if (!normalizedSegmentKey) return {};
  const rows = await llmBanditStateRepo.listBanditArmStatesBySegment(normalizedSegmentKey, 200).catch(() => []);
  const out = Object.create(null);
  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const armId = normalizeReplyText(row.armId);
    if (!armId) return;
    out[armId] = {
      pulls: Number.isFinite(Number(row.pulls)) ? Number(row.pulls) : 0,
      avgReward: Number.isFinite(Number(row.avgReward)) ? Number(row.avgReward) : 0
    };
  });
  return out;
}

async function loadContextualBanditStateByArm(segmentKey, contextSignature) {
  const normalizedSegmentKey = normalizeReplyText(segmentKey);
  const normalizedContextSignature = normalizeReplyText(contextSignature);
  if (!normalizedSegmentKey || !normalizedContextSignature) return {};
  const rows = await llmContextualBanditStateRepo
    .listBanditArmStatesByContext(normalizedSegmentKey, normalizedContextSignature, 200)
    .catch(() => []);
  const out = Object.create(null);
  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const armId = normalizeReplyText(row.armId);
    if (!armId) return;
    out[armId] = {
      pulls: Number.isFinite(Number(row.pulls)) ? Number(row.pulls) : 0,
      avgReward: Number.isFinite(Number(row.avgReward)) ? Number(row.avgReward) : 0
    };
  });
  return out;
}

async function appendLlmActionLogBestEffort(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const lineUserId = normalizeReplyText(payload.lineUserId);
  if (!lineUserId) return;
  const conciergeMeta = payload.conciergeMeta && typeof payload.conciergeMeta === 'object' ? payload.conciergeMeta : {};
  const chosenAction = conciergeMeta.chosenAction && typeof conciergeMeta.chosenAction === 'object'
    ? conciergeMeta.chosenAction
    : {};
  const qualityMeta = payload.conversationQuality && typeof payload.conversationQuality === 'object'
    ? payload.conversationQuality
    : buildConversationQualityMeta({
      replyText: payload.replyText || '',
      domainIntent: payload.domainIntent || 'general',
      opportunityReasonKeys: payload.opportunityReasonKeys
    });
  const riskSnapshot = resolveIntentRiskTier({
    domainIntent: qualityMeta.domainIntent || payload.domainIntent,
    reasonCodes: payload.riskReasonCodes
  });
  const legalSnapshot = payload.legalSnapshot && typeof payload.legalSnapshot === 'object'
    ? resolveLlmLegalPolicySnapshot({ policy: payload.legalSnapshot })
    : resolveLlmLegalPolicySnapshot({ policy: null });
  const sourceAuthorityScore = Number.isFinite(Number(payload.sourceAuthorityScore))
    ? Number(payload.sourceAuthorityScore)
    : (conciergeMeta && Number.isFinite(Number(conciergeMeta.sourceAuthorityScore)) ? Number(conciergeMeta.sourceAuthorityScore) : null);
  const sourceFreshnessScore = Number.isFinite(Number(payload.sourceFreshnessScore))
    ? Number(payload.sourceFreshnessScore)
    : (conciergeMeta && Number.isFinite(Number(conciergeMeta.sourceFreshnessScore)) ? Number(conciergeMeta.sourceFreshnessScore) : null);
  const sourceReadinessDecision = typeof payload.sourceReadinessDecision === 'string'
    ? payload.sourceReadinessDecision
    : (conciergeMeta && typeof conciergeMeta.sourceReadinessDecision === 'string' ? conciergeMeta.sourceReadinessDecision : null);
  const sourceReadinessReasons = Array.isArray(payload.sourceReadinessReasons)
    ? payload.sourceReadinessReasons
    : (conciergeMeta && Array.isArray(conciergeMeta.sourceReadinessReasons) ? conciergeMeta.sourceReadinessReasons : []);
  const officialOnlySatisfied = payload.officialOnlySatisfied === true
    || (conciergeMeta && conciergeMeta.officialOnlySatisfied === true);
  const answerReadinessLogOnly = typeof payload.answerReadinessLogOnly === 'boolean'
    ? payload.answerReadinessLogOnly
    : false;
  const assistantQualityForReadiness = normalizeAssistantQuality(payload.assistantQuality, {
    intentResolved: payload.intent || 'faq_search',
    blockedStage: payload.decision === 'allow' ? null : 'route_gate',
    fallbackReason: qualityMeta.fallbackType || payload.blockedReason || null
  });
  const readinessTelemetry = resolveAnswerReadinessTelemetry({
    legalSnapshot,
    riskSnapshot,
    sourceAuthorityScore,
    sourceFreshnessScore,
    sourceReadinessDecision,
    officialOnlySatisfied,
    assistantQuality: assistantQualityForReadiness,
    fallbackType: qualityMeta.fallbackType || payload.blockedReason || null,
    contradictionFlags: Array.isArray(payload.contradictionFlags) ? payload.contradictionFlags : [],
    unsupportedClaimCount: payload.unsupportedClaimCount,
    contradictionDetected: payload.contradictionDetected === true
  });
  const responseContractConformance = payload.responseContractConformance
    && typeof payload.responseContractConformance === 'object'
    ? payload.responseContractConformance
    : evaluateResponseContractConformance({
      replyText: payload.replyText || payload.finalReplyText || '',
      domainIntent: qualityMeta.domainIntent || payload.domainIntent || 'general',
      conversationMode: typeof payload.conversationMode === 'string'
        ? payload.conversationMode
        : (conciergeMeta && conciergeMeta.conversationState ? 'concierge' : null),
      nextSteps: Array.isArray(payload.committedNextActions) ? payload.committedNextActions : [],
      followupQuestion: typeof payload.committedFollowupQuestion === 'string'
        ? payload.committedFollowupQuestion
        : null
    });
  const semanticTrace = resolveSemanticTraceTelemetry(responseContractConformance);
  const routeCoverageMeta = resolveRouteCoverageMeta({
    entryType: 'webhook',
    routeKind: payload.routeKind || 'canonical',
    routerReason: payload.routerReason,
    fallbackType: typeof payload.fallbackType === 'string' && payload.fallbackType.trim()
      ? payload.fallbackType
      : (qualityMeta.fallbackType || payload.blockedReason || null),
    compatFallbackReason: payload.compatFallbackReason,
    sharedReadinessBridge: payload.sharedReadinessBridge || 'webhook_direct_readiness',
    routeDecisionSource: payload.routeDecisionSource
      || (typeof payload.routerReason === 'string' && payload.routerReason.trim() ? 'conversation_router' : 'webhook_route')
  });
  const messageText = normalizeReplyText(payload.messageText || payload.text || '');
  const replyText = resolveTranscriptSnapshotAssistantReplyText({
    replyText: payload.replyText,
    finalReplyText: payload.finalReplyText,
    qualityMeta,
    responseContractConformance
  });
  let transcriptSnapshotResult = null;

  try {
    transcriptSnapshotResult = await appendConversationReviewSnapshot({
      lineUserId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      routeKind: routeCoverageMeta.routeKind,
      domainIntent: qualityMeta.domainIntent || payload.domainIntent || 'general',
      strategy: typeof payload.strategy === 'string' && payload.strategy.trim()
        ? payload.strategy.trim()
        : (qualityMeta.strategyReason || null),
      selectedCandidateKind: typeof payload.selectedCandidateKind === 'string' && payload.selectedCandidateKind.trim()
        ? payload.selectedCandidateKind.trim()
        : (qualityMeta.selectedCandidateKind || null),
      fallbackTemplateKind: typeof payload.fallbackTemplateKind === 'string' && payload.fallbackTemplateKind.trim()
        ? payload.fallbackTemplateKind.trim()
        : (qualityMeta.fallbackTemplateKind || null),
      replyTemplateFingerprint: typeof payload.replyTemplateFingerprint === 'string' && payload.replyTemplateFingerprint.trim()
        ? payload.replyTemplateFingerprint.trim()
        : (qualityMeta.replyTemplateFingerprint || null),
      priorContextUsed: payload.priorContextUsed === true || qualityMeta.priorContextUsed === true,
      followupResolvedFromHistory: payload.followupResolvedFromHistory === true || qualityMeta.followupResolvedFromHistory === true,
      knowledgeCandidateUsed: payload.knowledgeCandidateUsed === true || qualityMeta.knowledgeCandidateUsed === true,
      readinessDecision: payload.readinessDecision || readinessTelemetry.readiness.decision || null,
      genericFallbackSlice: typeof payload.genericFallbackSlice === 'string' && payload.genericFallbackSlice.trim()
        ? payload.genericFallbackSlice.trim()
        : (qualityMeta.genericFallbackSlice || null),
      userMessageText: messageText,
      assistantReplyText: replyText,
      priorContextSummaryText: typeof payload.priorContextSummaryText === 'string'
        ? payload.priorContextSummaryText
        : null,
      contextSnapshot: payload.contextSnapshot || null,
      contextResumeDomain: typeof payload.contextResumeDomain === 'string' ? payload.contextResumeDomain : null,
      followupIntent: typeof payload.followupIntent === 'string'
        ? payload.followupIntent
        : (qualityMeta.followupIntent || null),
      recentUserGoal: typeof payload.recentUserGoal === 'string' ? payload.recentUserGoal : null
    });
  } catch (_err) {
    transcriptSnapshotResult = {
      ok: false,
      written: false,
      skipped: false,
      failed: true,
      outcome: 'failed_unknown',
      reason: 'unknown_snapshot_error',
      transcriptSnapshotLineUserKeyAvailable: false,
      transcriptSnapshotUserMessageAvailable: false,
      transcriptSnapshotAssistantReplyAvailable: false,
      transcriptSnapshotPriorContextSummaryAvailable: false
    };
  }

  try {
    await llmActionLogsRepo.appendLlmActionLog({
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      entryType: routeCoverageMeta.entryType,
      lineUserId,
      plan: payload.plan || 'free',
      userTier: conciergeMeta.userTier || (payload.plan === 'pro' ? 'paid' : 'free'),
      mode: conciergeMeta.mode || 'A',
      topic: conciergeMeta.topic || 'general',
      intentConfidence: Number.isFinite(Number(conciergeMeta.intentConfidence)) ? Number(conciergeMeta.intentConfidence) : 0,
      contextConfidence: Number.isFinite(Number(conciergeMeta.contextConfidence)) ? Number(conciergeMeta.contextConfidence) : 0,
      conversationState: conciergeMeta.conversationState || null,
      conversationMove: conciergeMeta.conversationMove || null,
      styleId: conciergeMeta.styleId || null,
      actionClass: typeof payload.actionClass === 'string' && payload.actionClass.trim()
        ? payload.actionClass.trim().toLowerCase()
        : null,
      actionGatewayEnabled: payload.actionGatewayEnabled === true,
      actionGatewayEnforced: payload.actionGatewayEnforced === true,
      actionGatewayAllowed: payload.actionGatewayAllowed !== false,
      actionGatewayDecision: typeof payload.actionGatewayDecision === 'string' && payload.actionGatewayDecision.trim()
        ? payload.actionGatewayDecision.trim().toLowerCase()
        : null,
      actionGatewayReason: typeof payload.actionGatewayReason === 'string' && payload.actionGatewayReason.trim()
        ? payload.actionGatewayReason.trim().toLowerCase().replace(/\s+/g, '_')
        : null,
      parentIntentType: typeof payload.parentIntentType === 'string' && payload.parentIntentType.trim()
        ? payload.parentIntentType.trim().toUpperCase()
        : null,
      parentAnswerMode: typeof payload.parentAnswerMode === 'string' && payload.parentAnswerMode.trim()
        ? payload.parentAnswerMode.trim().toUpperCase()
        : null,
      parentLifecycleStage: typeof payload.parentLifecycleStage === 'string' && payload.parentLifecycleStage.trim()
        ? payload.parentLifecycleStage.trim().toUpperCase()
        : null,
      parentChapter: typeof payload.parentChapter === 'string' && payload.parentChapter.trim()
        ? payload.parentChapter.trim().toUpperCase()
        : null,
      parentRoutingInvariantStatus: typeof payload.parentRoutingInvariantStatus === 'string' && payload.parentRoutingInvariantStatus.trim()
        ? payload.parentRoutingInvariantStatus.trim().toLowerCase()
        : null,
      parentRoutingInvariantErrors: Array.isArray(payload.parentRoutingInvariantErrors)
        ? payload.parentRoutingInvariantErrors
          .map((item) => (typeof item === 'string' ? item.trim().toLowerCase().replace(/\s+/g, '_') : ''))
          .filter(Boolean)
          .slice(0, 8)
        : [],
      requiredCoreFactsComplete: payload.requiredCoreFactsComplete === true,
      missingRequiredCoreFacts: Array.isArray(payload.missingRequiredCoreFacts)
        ? payload.missingRequiredCoreFacts
          .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
          .filter(Boolean)
          .slice(0, 12)
        : [],
      missingRequiredCoreFactsCount: Number.isFinite(Number(payload.missingRequiredCoreFactsCount))
        ? Number(payload.missingRequiredCoreFactsCount)
        : 0,
      requiredCoreFactsCriticalMissingCount: Number.isFinite(Number(payload.requiredCoreFactsCriticalMissingCount))
        ? Number(payload.requiredCoreFactsCriticalMissingCount)
        : 0,
      requiredCoreFactsGateDecision: typeof payload.requiredCoreFactsGateDecision === 'string' && payload.requiredCoreFactsGateDecision.trim()
        ? payload.requiredCoreFactsGateDecision.trim().toLowerCase()
        : null,
      requiredCoreFactsGateLogOnly: payload.requiredCoreFactsGateLogOnly === true,
      routeKind: routeCoverageMeta.routeKind,
      conversationMode: typeof payload.conversationMode === 'string'
        ? payload.conversationMode
        : (conciergeMeta && conciergeMeta.conversationState ? 'concierge' : null),
      routerReason: routeCoverageMeta.routerReason,
      routerReasonObserved: routeCoverageMeta.routerReasonObserved,
      compatFallbackReason: routeCoverageMeta.compatFallbackReason,
      sharedReadinessBridge: routeCoverageMeta.sharedReadinessBridge,
      sharedReadinessBridgeObserved: routeCoverageMeta.sharedReadinessBridgeObserved,
      routeDecisionSource: routeCoverageMeta.routeDecisionSource,
      opportunityType: typeof payload.opportunityType === 'string' && payload.opportunityType.trim()
        ? payload.opportunityType.trim().toLowerCase()
        : 'none',
      opportunityReasonKeys: Array.isArray(payload.opportunityReasonKeys)
        ? payload.opportunityReasonKeys
          .map((item) => (typeof item === 'string' ? item.trim().toLowerCase().replace(/\s+/g, '_') : ''))
          .filter(Boolean)
          .slice(0, 8)
        : [],
      interventionBudget: Number.isFinite(Number(payload.interventionBudget))
        ? (Number(payload.interventionBudget) >= 1 ? 1 : 0)
        : 0,
      contextVersion: conciergeMeta.contextVersion || 'concierge_ctx_v1',
      featureHash: conciergeMeta.featureHash || null,
      segmentKey: conciergeMeta.segmentKey || null,
      banditEnabled: payload.llmBanditEnabled === true,
      epsilon: 0.1,
      chosenAction,
      selectionSource: chosenAction.selectionSource || 'score',
      score: Number.isFinite(Number(chosenAction.score)) ? Number(chosenAction.score) : 0,
      scoreBreakdown: chosenAction.scoreBreakdown && typeof chosenAction.scoreBreakdown === 'object'
        ? chosenAction.scoreBreakdown
        : {},
      evidenceNeed: conciergeMeta.evidenceNeed || 'none',
      evidenceOutcome: conciergeMeta.evidenceOutcome || 'SUPPORTED',
      urlCount: Number.isFinite(Number(conciergeMeta.urlCount)) ? Number(conciergeMeta.urlCount) : 0,
      citationRanks: Array.isArray(conciergeMeta.citationRanks) ? conciergeMeta.citationRanks : [],
      blockedReasons: Array.isArray(conciergeMeta.blockedReasons) ? conciergeMeta.blockedReasons : [],
      injectionFindings: conciergeMeta.injectionFindings === true,
      postRenderLint: conciergeMeta.postRenderLint && typeof conciergeMeta.postRenderLint === 'object'
        ? conciergeMeta.postRenderLint
        : { findings: [], modified: false },
      contextSignature: typeof conciergeMeta.contextSignature === 'string'
        ? conciergeMeta.contextSignature
        : null,
      contextualBanditEnabled: conciergeMeta.contextualBanditEnabled === true,
      contextualFeatures: conciergeMeta.contextualFeatures && typeof conciergeMeta.contextualFeatures === 'object'
        ? conciergeMeta.contextualFeatures
        : null,
      counterfactualSelectedArmId: typeof conciergeMeta.counterfactualSelectedArmId === 'string'
        ? conciergeMeta.counterfactualSelectedArmId
        : null,
      counterfactualSelectedRank: Number.isFinite(Number(conciergeMeta.counterfactualSelectedRank))
        ? Number(conciergeMeta.counterfactualSelectedRank)
        : null,
      counterfactualTopArms: Array.isArray(conciergeMeta.counterfactualTopArms)
        ? conciergeMeta.counterfactualTopArms
        : [],
      counterfactualEval: conciergeMeta.counterfactualEval && typeof conciergeMeta.counterfactualEval === 'object'
        ? conciergeMeta.counterfactualEval
        : null,
      rewardPending: true,
      reward: null,
      rewardVersion: 'v1',
      rewardWindowHours: 48,
      conversationNaturalnessVersion: qualityMeta.conversationNaturalnessVersion,
      legacyTemplateHit: qualityMeta.legacyTemplateHit === true,
      followupQuestionIncluded: qualityMeta.followupQuestionIncluded === true,
      actionCount: Number.isFinite(Number(qualityMeta.actionCount)) ? Number(qualityMeta.actionCount) : 0,
      pitfallIncluded: qualityMeta.pitfallIncluded === true,
      domainIntent: qualityMeta.domainIntent || 'general',
      intentRiskTier: riskSnapshot.intentRiskTier,
      riskReasonCodes: riskSnapshot.riskReasonCodes,
      sourceAuthorityScore,
      sourceFreshnessScore,
      sourceReadinessDecision,
      sourceReadinessReasons,
      evidenceCoverage: Number.isFinite(Number(readinessTelemetry.readinessTelemetryV2.evidenceCoverage))
        ? Number(readinessTelemetry.readinessTelemetryV2.evidenceCoverage)
        : null,
      evidenceCoverageObserved: readinessTelemetry.readinessTelemetryV2.evidenceCoverageObserved === true
        ? true
        : (readinessTelemetry.readinessTelemetryV2.evidenceCoverageObserved === false ? false : null),
      officialOnlySatisfied,
      officialOnlySatisfiedObserved: readinessTelemetry.readinessTelemetryV2.officialOnlySatisfiedObserved === true
        ? true
        : (readinessTelemetry.readinessTelemetryV2.officialOnlySatisfiedObserved === false ? false : null),
      readinessDecision: readinessTelemetry.readiness.decision,
      readinessReasonCodes: readinessTelemetry.readiness.reasonCodes,
      readinessSafeResponseMode: readinessTelemetry.readiness.safeResponseMode,
      answerReadinessVersion: readinessTelemetry.answerReadinessVersion,
      answerReadinessLogOnlyV2: readinessTelemetry.answerReadinessLogOnlyV2 === true,
      answerReadinessEnforcedV2: readinessTelemetry.answerReadinessEnforcedV2 === true,
      answerReadinessV2Mode: readinessTelemetry.answerReadinessV2Mode || null,
      answerReadinessV2Stage: readinessTelemetry.answerReadinessV2Stage || null,
      answerReadinessV2EnforcementReason: readinessTelemetry.answerReadinessV2EnforcementReason || null,
      readinessDecisionSource: readinessTelemetry.readiness.decisionSource || null,
      readinessDecisionSourceV2: readinessTelemetry.readinessV2.decisionSource || null,
      readinessHardeningVersion: readinessTelemetry.readinessTelemetryV2.readinessHardeningVersion || null,
      readinessDecisionV2: readinessTelemetry.readinessV2.decision,
      readinessReasonCodesV2: readinessTelemetry.readinessV2.reasonCodes,
      readinessSafeResponseModeV2: readinessTelemetry.readinessV2.safeResponseMode,
      emergencyContextActive: readinessTelemetry.readinessTelemetryV2.emergencyContextActive === true,
      emergencyOfficialSourceSatisfied: readinessTelemetry.readinessTelemetryV2.emergencyOfficialSourceSatisfied === true,
      emergencyOfficialSourceSatisfiedObserved: readinessTelemetry.readinessTelemetryV2.emergencyOfficialSourceSatisfiedObserved === true
        ? true
        : (readinessTelemetry.readinessTelemetryV2.emergencyOfficialSourceSatisfiedObserved === false ? false : null),
      journeyPhase: readinessTelemetry.readinessTelemetryV2.journeyPhase || null,
      taskBlockerDetected: readinessTelemetry.readinessTelemetryV2.taskBlockerDetected === true,
      journeyAlignedAction: typeof readinessTelemetry.readinessTelemetryV2.journeyAlignedAction === 'boolean'
        ? readinessTelemetry.readinessTelemetryV2.journeyAlignedAction
        : true,
      journeyAlignedActionObserved: readinessTelemetry.readinessTelemetryV2.journeyAlignedActionObserved === true
        ? true
        : (readinessTelemetry.readinessTelemetryV2.journeyAlignedActionObserved === false ? false : null),
      cityPackGrounded: readinessTelemetry.readinessTelemetryV2.cityPackGrounded === true,
      cityPackGroundedObserved: readinessTelemetry.readinessTelemetryV2.cityPackGroundedObserved === true
        ? true
        : (readinessTelemetry.readinessTelemetryV2.cityPackGroundedObserved === false ? false : null),
      cityPackFreshnessScore: Number.isFinite(Number(readinessTelemetry.readinessTelemetryV2.cityPackFreshnessScore))
        ? Number(readinessTelemetry.readinessTelemetryV2.cityPackFreshnessScore)
        : null,
      cityPackAuthorityScore: Number.isFinite(Number(readinessTelemetry.readinessTelemetryV2.cityPackAuthorityScore))
        ? Number(readinessTelemetry.readinessTelemetryV2.cityPackAuthorityScore)
        : null,
      staleSourceBlocked: readinessTelemetry.readinessTelemetryV2.staleSourceBlocked === true
        ? true
        : (readinessTelemetry.readinessTelemetryV2.staleSourceBlocked === false ? false : null),
      staleSourceBlockedObserved: readinessTelemetry.readinessTelemetryV2.staleSourceBlockedObserved === true
        ? true
        : (readinessTelemetry.readinessTelemetryV2.staleSourceBlockedObserved === false ? false : null),
      savedFaqReused: readinessTelemetry.readinessTelemetryV2.savedFaqReused === true,
      savedFaqReusePass: readinessTelemetry.readinessTelemetryV2.savedFaqReusePass === true,
      savedFaqReusePassObserved: readinessTelemetry.readinessTelemetryV2.savedFaqReusePassObserved === true
        ? true
        : (readinessTelemetry.readinessTelemetryV2.savedFaqReusePassObserved === false ? false : null),
      savedFaqReuseReasonCodes: Array.isArray(payload.savedFaqReuseReasonCodes)
        ? payload.savedFaqReuseReasonCodes
        : [],
      savedFaqValid: typeof readinessTelemetry.readinessTelemetryV2.savedFaqValid === 'boolean'
        ? readinessTelemetry.readinessTelemetryV2.savedFaqValid
        : null,
      savedFaqAllowedIntent: typeof readinessTelemetry.readinessTelemetryV2.savedFaqAllowedIntent === 'boolean'
        ? readinessTelemetry.readinessTelemetryV2.savedFaqAllowedIntent
        : null,
      savedFaqAuthorityScore: Number.isFinite(Number(readinessTelemetry.readinessTelemetryV2.savedFaqAuthorityScore))
        ? Number(readinessTelemetry.readinessTelemetryV2.savedFaqAuthorityScore)
        : null,
      sourceSnapshotRefs: Array.isArray(readinessTelemetry.readinessTelemetryV2.sourceSnapshotRefs)
        ? readinessTelemetry.readinessTelemetryV2.sourceSnapshotRefs
        : [],
      crossSystemConflictDetected: readinessTelemetry.readinessTelemetryV2.crossSystemConflictDetected === true,
      unsupportedClaimCount: readinessTelemetry.unsupportedClaimCount,
      contradictionDetected: readinessTelemetry.contradictionDetected,
      answerReadinessLogOnly,
      orchestratorPathUsed: payload.orchestratorPathUsed === true,
      contextResumeDomain: typeof payload.contextResumeDomain === 'string' && payload.contextResumeDomain.trim()
        ? payload.contextResumeDomain.trim().toLowerCase()
        : null,
      loopBreakApplied: payload.loopBreakApplied === true,
      followupIntent: typeof payload.followupIntent === 'string' && payload.followupIntent.trim()
        ? payload.followupIntent.trim().toLowerCase()
        : (qualityMeta.followupIntent || null),
      conciseModeApplied: payload.conciseModeApplied === true || qualityMeta.conciseModeApplied === true,
      repetitionPrevented: payload.repetitionPrevented === true || qualityMeta.repetitionPrevented === true,
      directAnswerApplied: payload.directAnswerApplied === true || qualityMeta.directAnswerApplied === true,
      clarifySuppressed: payload.clarifySuppressed === true || qualityMeta.clarifySuppressed === true,
      misunderstandingRecovered: payload.misunderstandingRecovered === true || qualityMeta.misunderstandingRecovered === true,
      contextCarryScore: Number.isFinite(Number(payload.contextCarryScore))
        ? Number(payload.contextCarryScore)
        : Number(qualityMeta.contextCarryScore || 0),
      repeatRiskScore: Number.isFinite(Number(payload.repeatRiskScore))
        ? Number(payload.repeatRiskScore)
        : Number(qualityMeta.repeatRiskScore || 0),
      strategyReason: typeof payload.strategyReason === 'string' && payload.strategyReason.trim()
        ? payload.strategyReason.trim().toLowerCase()
        : (qualityMeta.strategyReason || null),
      strategyAlternativeSet: Array.isArray(payload.strategyAlternativeSet)
        ? payload.strategyAlternativeSet
          .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
          .filter(Boolean)
          .slice(0, 8)
        : (Array.isArray(qualityMeta.strategyAlternativeSet) ? qualityMeta.strategyAlternativeSet : []),
      strategyPriorityVersion: typeof payload.strategyPriorityVersion === 'string' && payload.strategyPriorityVersion.trim()
        ? payload.strategyPriorityVersion.trim()
        : (qualityMeta.strategyPriorityVersion || null),
      fallbackPriorityReason: typeof payload.fallbackPriorityReason === 'string' && payload.fallbackPriorityReason.trim()
        ? payload.fallbackPriorityReason.trim().toLowerCase()
        : (qualityMeta.fallbackPriorityReason || null),
      selectedCandidateKind: typeof payload.selectedCandidateKind === 'string' && payload.selectedCandidateKind.trim()
        ? payload.selectedCandidateKind.trim().toLowerCase()
        : (qualityMeta.selectedCandidateKind || null),
      selectedByDirectAnswerFirst: payload.selectedByDirectAnswerFirst === true || qualityMeta.selectedByDirectAnswerFirst === true,
      retrievalBlockedByStrategy: payload.retrievalBlockedByStrategy === true || qualityMeta.retrievalBlockedByStrategy === true,
      retrievalBlockReason: typeof payload.retrievalBlockReason === 'string' && payload.retrievalBlockReason.trim()
        ? payload.retrievalBlockReason.trim().toLowerCase()
        : (qualityMeta.retrievalBlockReason || null),
      retrievalPermitReason: typeof payload.retrievalPermitReason === 'string' && payload.retrievalPermitReason.trim()
        ? payload.retrievalPermitReason.trim().toLowerCase()
        : (qualityMeta.retrievalPermitReason || null),
      retrievalReenabledBySlice: typeof payload.retrievalReenabledBySlice === 'string' && payload.retrievalReenabledBySlice.trim()
        ? payload.retrievalReenabledBySlice.trim().toLowerCase()
        : (qualityMeta.retrievalReenabledBySlice || null),
      fallbackTemplateKind: typeof payload.fallbackTemplateKind === 'string' && payload.fallbackTemplateKind.trim()
        ? payload.fallbackTemplateKind.trim().toLowerCase()
        : (qualityMeta.fallbackTemplateKind || null),
      finalizerTemplateKind: typeof payload.finalizerTemplateKind === 'string' && payload.finalizerTemplateKind.trim()
        ? payload.finalizerTemplateKind.trim().toLowerCase()
        : (qualityMeta.finalizerTemplateKind || null),
      replyTemplateFingerprint: typeof payload.replyTemplateFingerprint === 'string' && payload.replyTemplateFingerprint.trim()
        ? payload.replyTemplateFingerprint.trim()
        : (qualityMeta.replyTemplateFingerprint || null),
      priorContextUsed: payload.priorContextUsed === true || qualityMeta.priorContextUsed === true,
      followupResolvedFromHistory: payload.followupResolvedFromHistory === true || qualityMeta.followupResolvedFromHistory === true,
      continuationReason: typeof payload.continuationReason === 'string' && payload.continuationReason.trim()
        ? payload.continuationReason.trim().toLowerCase()
        : (qualityMeta.continuationReason || null),
      knowledgeCandidateCountBySource: payload.knowledgeCandidateCountBySource
        && typeof payload.knowledgeCandidateCountBySource === 'object'
        ? Object.assign({}, payload.knowledgeCandidateCountBySource)
        : (qualityMeta.knowledgeCandidateCountBySource && typeof qualityMeta.knowledgeCandidateCountBySource === 'object'
          ? Object.assign({}, qualityMeta.knowledgeCandidateCountBySource)
          : null),
      knowledgeCandidateUsed: payload.knowledgeCandidateUsed === true || qualityMeta.knowledgeCandidateUsed === true,
      knowledgeCandidateRejectedReason: typeof payload.knowledgeCandidateRejectedReason === 'string' && payload.knowledgeCandidateRejectedReason.trim()
        ? payload.knowledgeCandidateRejectedReason.trim().toLowerCase()
        : (qualityMeta.knowledgeCandidateRejectedReason || null),
      knowledgeRejectedReasons: Array.isArray(payload.knowledgeRejectedReasons)
        ? normalizeReasonList(payload.knowledgeRejectedReasons, 8)
        : (Array.isArray(qualityMeta.knowledgeRejectedReasons) ? normalizeReasonList(qualityMeta.knowledgeRejectedReasons, 8) : []),
      cityPackCandidateAvailable: payload.cityPackCandidateAvailable === true || qualityMeta.cityPackCandidateAvailable === true,
      cityPackRejectedReason: typeof payload.cityPackRejectedReason === 'string' && payload.cityPackRejectedReason.trim()
        ? payload.cityPackRejectedReason.trim().toLowerCase()
        : (qualityMeta.cityPackRejectedReason || null),
      cityPackUsedInAnswer: payload.cityPackUsedInAnswer === true || qualityMeta.cityPackUsedInAnswer === true,
      savedFaqCandidateAvailable: payload.savedFaqCandidateAvailable === true || qualityMeta.savedFaqCandidateAvailable === true,
      savedFaqRejectedReason: typeof payload.savedFaqRejectedReason === 'string' && payload.savedFaqRejectedReason.trim()
        ? payload.savedFaqRejectedReason.trim().toLowerCase()
        : (qualityMeta.savedFaqRejectedReason || null),
      savedFaqUsedInAnswer: payload.savedFaqUsedInAnswer === true || qualityMeta.savedFaqUsedInAnswer === true,
      sourceReadinessDecisionSource: typeof payload.sourceReadinessDecisionSource === 'string' && payload.sourceReadinessDecisionSource.trim()
        ? payload.sourceReadinessDecisionSource.trim().toLowerCase()
        : (qualityMeta.sourceReadinessDecisionSource || null),
      knowledgeGroundingKind: typeof payload.knowledgeGroundingKind === 'string' && payload.knowledgeGroundingKind.trim()
        ? payload.knowledgeGroundingKind.trim().toLowerCase()
        : (qualityMeta.knowledgeGroundingKind || null),
      groundedCandidateAvailable: payload.groundedCandidateAvailable === true || qualityMeta.groundedCandidateAvailable === true,
      structuredCandidateAvailable: payload.structuredCandidateAvailable === true || qualityMeta.structuredCandidateAvailable === true,
      continuationCandidateAvailable: payload.continuationCandidateAvailable === true || qualityMeta.continuationCandidateAvailable === true,
      genericFallbackSlice: typeof payload.genericFallbackSlice === 'string' && payload.genericFallbackSlice.trim()
        ? payload.genericFallbackSlice.trim().toLowerCase()
        : (qualityMeta.genericFallbackSlice || null),
      fallbackType: qualityMeta.fallbackType || null,
      interventionSuppressedBy: qualityMeta.interventionSuppressedBy || null,
      responseContractConformant: responseContractConformance.conformant === true,
      responseContractErrorCount: Number.isFinite(Number(responseContractConformance.errorCount))
        ? Number(responseContractConformance.errorCount)
        : 0,
      responseContractErrors: Array.isArray(responseContractConformance.errors)
        ? responseContractConformance.errors
        : [],
      responseContractFallbackApplied: responseContractConformance.fallbackApplied === true,
      contractVersion: semanticTrace.contractVersion,
      pathType: semanticTrace.pathType,
      uUnits: semanticTrace.uUnits,
      serviceSurface: semanticTrace.serviceSurface,
      groupPrivacyMode: semanticTrace.groupPrivacyMode,
      handoffState: semanticTrace.handoffState,
      memoryReadScopes: semanticTrace.memoryReadScopes,
      memoryWriteScopes: semanticTrace.memoryWriteScopes,
      citationFinalized: semanticTrace.citationFinalized,
      citationFreshnessStatus: semanticTrace.citationFreshnessStatus,
      citationAuthoritySatisfied: semanticTrace.citationAuthoritySatisfied,
      citationDisclaimerRequired: semanticTrace.citationDisclaimerRequired,
      policySourceResolved: semanticTrace.policySourceResolved,
      policyGate: semanticTrace.policyGate,
      policyDisclosureRequired: semanticTrace.policyDisclosureRequired,
      policyEscalationRequired: semanticTrace.policyEscalationRequired,
      strategy: typeof payload.strategy === 'string' ? payload.strategy : null,
      retrieveNeeded: payload.retrieveNeeded === true,
      retrievalQuality: typeof payload.retrievalQuality === 'string' ? payload.retrievalQuality : null,
      judgeWinner: typeof payload.judgeWinner === 'string' ? payload.judgeWinner : null,
      judgeScores: Array.isArray(payload.judgeScores) ? payload.judgeScores : [],
      verificationOutcome: typeof payload.verificationOutcome === 'string' ? payload.verificationOutcome : null,
      contradictionFlags: Array.isArray(payload.contradictionFlags) ? payload.contradictionFlags : [],
      requestShape: typeof payload.requestShape === 'string' ? payload.requestShape : null,
      depthIntent: typeof payload.depthIntent === 'string' ? payload.depthIntent : null,
      transformSource: typeof payload.transformSource === 'string' ? payload.transformSource : null,
      outputForm: typeof payload.outputForm === 'string' ? payload.outputForm : null,
      knowledgeScope: typeof payload.knowledgeScope === 'string' ? payload.knowledgeScope : null,
      locationHintKind: typeof payload.locationHintKind === 'string' ? payload.locationHintKind : null,
      locationHintCityKey: typeof payload.locationHintCityKey === 'string' ? payload.locationHintCityKey : null,
      locationHintState: typeof payload.locationHintState === 'string' ? payload.locationHintState : null,
      locationHintRegionKey: typeof payload.locationHintRegionKey === 'string' ? payload.locationHintRegionKey : null,
      detailObligations: Array.isArray(payload.detailObligations) ? payload.detailObligations : [],
      answerability: typeof payload.answerability === 'string' ? payload.answerability : null,
      echoOfPriorAssistant: typeof payload.echoOfPriorAssistant === 'boolean' ? payload.echoOfPriorAssistant : null,
      requestedCityKey: typeof payload.requestedCityKey === 'string' ? payload.requestedCityKey : null,
      matchedCityKey: typeof payload.matchedCityKey === 'string' ? payload.matchedCityKey : null,
      citySpecificitySatisfied: typeof payload.citySpecificitySatisfied === 'boolean' ? payload.citySpecificitySatisfied : null,
      citySpecificityReason: typeof payload.citySpecificityReason === 'string' ? payload.citySpecificityReason : null,
      scopeDisclosureRequired: typeof payload.scopeDisclosureRequired === 'boolean' ? payload.scopeDisclosureRequired : null,
      violationCodes: Array.isArray(payload.violationCodes) ? payload.violationCodes : [],
      candidateCount: Number.isFinite(Number(payload.candidateCount)) ? Number(payload.candidateCount) : 0,
      humanReviewLabel: typeof payload.humanReviewLabel === 'string' ? payload.humanReviewLabel : null,
      committedNextActions: Array.isArray(payload.committedNextActions) ? payload.committedNextActions : [],
      committedFollowupQuestion: typeof payload.committedFollowupQuestion === 'string'
        ? payload.committedFollowupQuestion
        : null,
      recentUserGoal: typeof payload.recentUserGoal === 'string' ? payload.recentUserGoal : null,
      transcriptSnapshotOutcome: transcriptSnapshotResult && transcriptSnapshotResult.outcome ? transcriptSnapshotResult.outcome : null,
      transcriptSnapshotReason: transcriptSnapshotResult && transcriptSnapshotResult.reason ? transcriptSnapshotResult.reason : null,
      transcriptSnapshotLineUserKeyAvailable: transcriptSnapshotResult
        ? transcriptSnapshotResult.transcriptSnapshotLineUserKeyAvailable === true
        : null,
      transcriptSnapshotUserMessageAvailable: transcriptSnapshotResult
        ? transcriptSnapshotResult.transcriptSnapshotUserMessageAvailable === true
        : null,
      transcriptSnapshotAssistantReplyAvailable: transcriptSnapshotResult
        ? transcriptSnapshotResult.transcriptSnapshotAssistantReplyAvailable === true
        : null,
      transcriptSnapshotPriorContextSummaryAvailable: transcriptSnapshotResult
        ? transcriptSnapshotResult.transcriptSnapshotPriorContextSummaryAvailable === true
        : null,
      transcriptSnapshotAssistantReplyPresent: transcriptSnapshotResult
        ? transcriptSnapshotResult.transcriptSnapshotAssistantReplyPresent
        : null,
      transcriptSnapshotAssistantReplyLength: transcriptSnapshotResult
        ? transcriptSnapshotResult.transcriptSnapshotAssistantReplyLength
        : null,
      transcriptSnapshotSanitizedReplyLength: transcriptSnapshotResult
        ? transcriptSnapshotResult.transcriptSnapshotSanitizedReplyLength
        : null,
      transcriptSnapshotBuildAttempted: transcriptSnapshotResult
        ? transcriptSnapshotResult.transcriptSnapshotBuildAttempted === true
        : null,
      transcriptSnapshotBuildSkippedReason: transcriptSnapshotResult
        ? transcriptSnapshotResult.transcriptSnapshotBuildSkippedReason
        : null
    });
  } catch (_err) {
    // best effort only
  }
  try {
    const messageText = normalizeReplyText(payload.messageText || payload.text || '');
    const replyText = normalizeReplyText(payload.replyText || payload.finalReplyText || '');
    if (messageText || replyText) {
      await appendConversationReviewSnapshot({
        lineUserId,
        traceId: payload.traceId || null,
        requestId: payload.requestId || null,
        routeKind: routeCoverageMeta.routeKind,
        domainIntent: qualityMeta.domainIntent || payload.domainIntent || 'general',
        strategy: typeof payload.strategy === 'string' && payload.strategy.trim()
          ? payload.strategy.trim()
          : (qualityMeta.strategyReason || null),
        selectedCandidateKind: typeof payload.selectedCandidateKind === 'string' && payload.selectedCandidateKind.trim()
          ? payload.selectedCandidateKind.trim()
          : (qualityMeta.selectedCandidateKind || null),
        fallbackTemplateKind: typeof payload.fallbackTemplateKind === 'string' && payload.fallbackTemplateKind.trim()
          ? payload.fallbackTemplateKind.trim()
          : (qualityMeta.fallbackTemplateKind || null),
        replyTemplateFingerprint: typeof payload.replyTemplateFingerprint === 'string' && payload.replyTemplateFingerprint.trim()
          ? payload.replyTemplateFingerprint.trim()
          : (qualityMeta.replyTemplateFingerprint || null),
        priorContextUsed: payload.priorContextUsed === true || qualityMeta.priorContextUsed === true,
        followupResolvedFromHistory: payload.followupResolvedFromHistory === true || qualityMeta.followupResolvedFromHistory === true,
        knowledgeCandidateUsed: payload.knowledgeCandidateUsed === true || qualityMeta.knowledgeCandidateUsed === true,
        readinessDecision: payload.readinessDecision || readinessTelemetry.readiness.decision || null,
        genericFallbackSlice: typeof payload.genericFallbackSlice === 'string' && payload.genericFallbackSlice.trim()
          ? payload.genericFallbackSlice.trim()
          : (qualityMeta.genericFallbackSlice || null),
        userMessageText: messageText,
        assistantReplyText: replyText,
        priorContextSummaryText: typeof payload.priorContextSummaryText === 'string'
          ? payload.priorContextSummaryText
          : null,
        contextSnapshot: payload.contextSnapshot || null,
        contextResumeDomain: typeof payload.contextResumeDomain === 'string' ? payload.contextResumeDomain : null,
        followupIntent: typeof payload.followupIntent === 'string'
          ? payload.followupIntent
          : (qualityMeta.followupIntent || null),
        recentUserGoal: typeof payload.recentUserGoal === 'string' ? payload.recentUserGoal : null
      });
    }
  } catch (_err) {
    // best effort only
  }
  try {
    const followupIntent = typeof payload.followupIntent === 'string' && payload.followupIntent.trim()
      ? payload.followupIntent.trim().toLowerCase()
      : (qualityMeta.followupIntent || null);
    upsertRecentTurn(lineUserId, {
      createdAt: new Date().toISOString(),
      requestId: payload.requestId || null,
      traceId: payload.traceId || null,
      domainIntent: qualityMeta.domainIntent || payload.domainIntent || 'general',
      followupIntent,
      replyText: normalizeReplyText(payload.replyText || payload.finalReplyText || ''),
      committedNextActions: Array.isArray(payload.committedNextActions) ? payload.committedNextActions : [],
      committedFollowupQuestion: typeof payload.committedFollowupQuestion === 'string'
        ? payload.committedFollowupQuestion
        : null,
      recentUserGoal: typeof payload.recentUserGoal === 'string' ? payload.recentUserGoal : null
    });
  } catch (_err) {
    // best effort only
  }
}

async function loadRecentActionRowsBestEffort(lineUserId, recentTurns) {
  const normalizedUserId = normalizeReplyText(lineUserId);
  if (!normalizedUserId) return [];
  const limit = Number.isFinite(Number(recentTurns))
    ? Math.max(5, Math.min(20, Math.floor(Number(recentTurns)) * 2))
    : 10;
  const cachedRows = listRecentTurns(normalizedUserId, limit);
  try {
    const storedRows = await llmActionLogsRepo.listLlmActionLogsByLineUserId({
      lineUserId: normalizedUserId,
      limit
    });
    const deduped = [];
    const seenRows = new Map();
    const toKey = (row) => {
      const requestId = normalizeReplyText(row && row.requestId);
      if (requestId) return `req:${requestId}`;
      const createdAt = normalizeReplyText(row && row.createdAt);
      const domainIntent = normalizeDomainIntent(row && row.domainIntent);
      const replyText = normalizeReplyText(row && row.replyText);
      return `row:${createdAt}:${domainIntent}:${replyText}`;
    };
    const mergeRows = (existing, incoming) => {
      const left = existing && typeof existing === 'object' ? existing : {};
      const right = incoming && typeof incoming === 'object' ? incoming : {};
      return Object.assign({}, left, right, {
        replyText: normalizeReplyText(right.replyText) || normalizeReplyText(left.replyText),
        committedNextActions: (
          Array.isArray(right.committedNextActions) && right.committedNextActions.length > 0
            ? right.committedNextActions
            : (Array.isArray(left.committedNextActions) ? left.committedNextActions : [])
        ),
        committedFollowupQuestion: normalizeReplyText(right.committedFollowupQuestion)
          || normalizeReplyText(left.committedFollowupQuestion)
          || null,
        recentUserGoal: normalizeReplyText(right.recentUserGoal)
          || normalizeReplyText(left.recentUserGoal)
          || null,
        followupIntent: normalizeReplyText(right.followupIntent)
          || normalizeReplyText(left.followupIntent)
          || null,
        requestShape: normalizeReplyText(right.requestShape)
          || normalizeReplyText(left.requestShape)
          || null,
        depthIntent: normalizeReplyText(right.depthIntent)
          || normalizeReplyText(left.depthIntent)
          || null,
        transformSource: normalizeReplyText(right.transformSource)
          || normalizeReplyText(left.transformSource)
          || null,
        outputForm: normalizeReplyText(right.outputForm)
          || normalizeReplyText(left.outputForm)
          || null,
        knowledgeScope: normalizeReplyText(right.knowledgeScope)
          || normalizeReplyText(left.knowledgeScope)
          || null,
        detailObligations: (
          Array.isArray(right.detailObligations) && right.detailObligations.length > 0
            ? right.detailObligations
            : (Array.isArray(left.detailObligations) ? left.detailObligations : [])
        ),
        locationHintKind: normalizeReplyText(right.locationHintKind)
          || normalizeReplyText(left.locationHintKind)
          || null,
        locationHintCityKey: normalizeReplyText(right.locationHintCityKey)
          || normalizeReplyText(left.locationHintCityKey)
          || null,
        locationHintState: normalizeReplyText(right.locationHintState)
          || normalizeReplyText(left.locationHintState)
          || null,
        locationHintRegionKey: normalizeReplyText(right.locationHintRegionKey)
          || normalizeReplyText(left.locationHintRegionKey)
          || null
      });
    };
    const pushRow = (row) => {
      if (!row || typeof row !== 'object') return;
      const key = toKey(row);
      if (!key) return;
      if (!seenRows.has(key)) {
        seenRows.set(key, row);
        return;
      }
      seenRows.set(key, mergeRows(seenRows.get(key), row));
    };
    (Array.isArray(storedRows) ? storedRows : []).forEach(pushRow);
    (Array.isArray(cachedRows) ? cachedRows : []).forEach(pushRow);
    seenRows.forEach((row) => deduped.push(row));
    deduped.sort((left, right) => toMillis(right && right.createdAt) - toMillis(left && left.createdAt));
    return deduped.slice(0, limit);
  } catch (_err) {
    return Array.isArray(cachedRows) ? cachedRows : [];
  }
}

async function tryHandlePaidOrchestratorV2(params) {
  const payload = params && typeof params === 'object' ? params : {};
  if (resolvePaidOrchestratorEnabled() !== true) return null;
  const legalSnapshot = payload.legalSnapshot && typeof payload.legalSnapshot === 'object'
    ? resolveLlmLegalPolicySnapshot({ policy: payload.legalSnapshot })
    : await loadLlmLegalPolicySnapshot({
      systemFlagsRepo: { getLlmPolicy }
    });
  const recentTurns = resolvePaidInterventionCooldownTurns();
  const recentActionRows = await loadRecentActionRowsBestEffort(payload.lineUserId, recentTurns);
  const groundedReplyFactory = async (options) => {
    const input = Object.assign({}, options, {
      lineUserId: payload.lineUserId,
      locale: 'ja',
      llmAdapter: llmClient,
      llmPolicy: payload.budgetPolicy,
      skipPersonalizedContext: payload.snapshotStrictMode === true,
      forceConversationFormat: true
    });
    if (payload.qualityEnabled === true) {
      return generatePaidFaqReply(input);
    }
    return generatePaidAssistantReply(input);
  };
  const domainCandidateFactory = async (options) => buildPaidDomainConciergeResult({
    lineUserId: payload.lineUserId,
    text: options && typeof options.messageText === 'string' ? options.messageText : payload.text,
    domainIntent: options && typeof options.domainIntent === 'string' ? options.domainIntent : payload.normalizedConversationIntent,
    contextSnapshot: options && options.contextSnapshot ? options.contextSnapshot : payload.contextSnapshot,
    opportunityDecision: options && options.opportunityDecision ? options.opportunityDecision : payload.opportunityDecision,
    followupIntent: options && typeof options.followupIntent === 'string' ? options.followupIntent : null,
    recentFollowupIntents: options && Array.isArray(options.recentFollowupIntents) ? options.recentFollowupIntents : [],
    recentResponseHints: options && Array.isArray(options.recentResponseHints) ? options.recentResponseHints : [],
    requestContract: options && options.requestContract && typeof options.requestContract === 'object'
      ? options.requestContract
      : null,
    recoverySignal: options && options.recoverySignal === true,
    recentEngagement: payload.recentEngagement,
    blockedReason: options && Object.prototype.hasOwnProperty.call(options, 'blockedReason') ? options.blockedReason : null,
    forceConcierge: true,
    conversationNaturalnessVersion: 'v2'
  });
  const composeCandidateFactory = async ({ groundedResult, packet }) => {
    if (!groundedResult || groundedResult.ok !== true || payload.llmConciergeEnabled !== true) return null;
      const storedCandidates = await resolveStoredCandidatesForPaid(groundedResult, {
        lineUserId: payload.lineUserId,
        locale: 'ja',
        domainIntent: packet.normalizedConversationIntent || 'general',
        intentRiskTier: resolveIntentRiskTier({
          domainIntent: packet.normalizedConversationIntent || 'general'
        }).intentRiskTier
      });
    return composeConciergeReply({
      question: packet.messageText,
      baseReplyText: groundedResult.replyText,
      legalSnapshot,
      domainIntent: packet.normalizedConversationIntent || 'general',
      intentRiskTier: resolveIntentRiskTier({
        domainIntent: packet.normalizedConversationIntent || 'general'
      }).intentRiskTier,
      opportunityHints: packet.opportunityDecision && packet.opportunityDecision.opportunityType !== 'none'
        ? {
          summary: groundedResult && groundedResult.output && typeof groundedResult.output.situation === 'string'
            ? groundedResult.output.situation
            : packet.messageText,
          nextActions: packet.opportunityDecision.suggestedAtoms && Array.isArray(packet.opportunityDecision.suggestedAtoms.nextActions)
            ? packet.opportunityDecision.suggestedAtoms.nextActions.slice(0, 3)
            : [],
          pitfall: packet.opportunityDecision.suggestedAtoms && typeof packet.opportunityDecision.suggestedAtoms.pitfall === 'string'
            ? packet.opportunityDecision.suggestedAtoms.pitfall
            : '',
          question: packet.opportunityDecision.suggestedAtoms && typeof packet.opportunityDecision.suggestedAtoms.question === 'string'
            ? packet.opportunityDecision.suggestedAtoms.question
            : ''
        }
        : null,
      userTier: 'paid',
      plan: payload.planInfo.plan,
      locale: 'ja',
      contextSnapshot: packet.contextSnapshot,
      storedCandidates,
      denylist: payload.budgetPolicy && Array.isArray(payload.budgetPolicy.forbidden_domains)
        ? payload.budgetPolicy.forbidden_domains
        : [],
      webSearchEnabled: payload.llmWebSearchEnabled,
      styleEngineEnabled: payload.llmStyleEngineEnabled,
      bandit: {
        enabled: payload.llmBanditEnabled,
        epsilon: 0.1,
        stateFetcher: payload.banditStateFetcher
      },
      env: process.env
    });
  };

  const orchestrated = await runPaidConversationOrchestrator({
    lineUserId: payload.lineUserId,
    traceId: payload.traceId,
    requestId: payload.requestId,
    messageText: payload.text,
    explicitPaidIntent: payload.explicitPaidIntent,
    paidIntent: payload.paidIntent,
    planInfo: payload.planInfo,
    routerMode: payload.routerMode,
    routerReason: payload.routerReason,
    contextSnapshot: payload.contextSnapshot,
    llmFlags: {
      llmConciergeEnabled: payload.llmConciergeEnabled,
      llmWebSearchEnabled: payload.llmWebSearchEnabled,
      llmStyleEngineEnabled: payload.llmStyleEngineEnabled,
      llmBanditEnabled: payload.llmBanditEnabled,
      qualityEnabled: payload.qualityEnabled,
      snapshotStrictMode: payload.snapshotStrictMode,
      actionGatewayEnabled: payload.actionGatewayEnabled === true
    },
    maxNextActionsCap: payload.maxNextActionsCap,
    recentEngagement: payload.recentEngagement,
    opportunityDecision: payload.opportunityDecision,
    recentActionRows,
    legalSnapshot,
    deps: {
      generatePaidCasualReply,
      generateGroundedReply: groundedReplyFactory,
      generateDomainConciergeCandidate: domainCandidateFactory,
      composeConciergeCandidate: composeCandidateFactory
    }
  });

  if (!orchestrated || orchestrated.ok !== true) return null;
  const orchestratedReplyEnvelope = buildSemanticReplyEnvelope({
    replyText: orchestrated.replyText,
    domainIntent: orchestrated.domainIntent || 'general',
    conversationMode: orchestrated.conversationMode || 'concierge',
    eventSource: payload.eventSource,
    pathType: 'slow',
    uUnits: ['U-05', 'U-06', 'U-09', 'U-10', 'U-11', 'U-12', 'U-13', 'U-16', 'U-17', 'U-23'],
    nextSteps: orchestrated.finalMeta && Array.isArray(orchestrated.finalMeta.committedNextActions)
      ? orchestrated.finalMeta.committedNextActions
      : [],
    followupQuestion: orchestrated.finalMeta && typeof orchestrated.finalMeta.committedFollowupQuestion === 'string'
      ? orchestrated.finalMeta.committedFollowupQuestion
      : null,
    warnings: orchestrated.conciergeMeta && Array.isArray(orchestrated.conciergeMeta.blockedReasons)
      ? orchestrated.conciergeMeta.blockedReasons
      : [],
    legalSnapshot,
    sourceAuthorityScore: orchestrated.telemetry ? orchestrated.telemetry.sourceAuthorityScore : null,
    sourceFreshnessScore: orchestrated.telemetry ? orchestrated.telemetry.sourceFreshnessScore : null,
    sourceReadinessDecision: orchestrated.telemetry ? orchestrated.telemetry.sourceReadinessDecision : null,
    officialOnlySatisfied: orchestrated.telemetry ? orchestrated.telemetry.officialOnlySatisfied === true : false,
    readinessDecision: orchestrated.telemetry ? orchestrated.telemetry.readinessDecision : null,
    readinessReasonCodes: orchestrated.telemetry ? orchestrated.telemetry.readinessReasonCodes : [],
    actionClass: orchestrated.telemetry ? orchestrated.telemetry.actionClass : null
  });
  const orchestratedReplyText = orchestratedReplyEnvelope.replyText;
  await payload.replyFn(
    payload.replyToken,
    orchestratedReplyEnvelope.lineMessage || { type: 'text', text: orchestratedReplyText }
  );
  const conversationQuality = buildConversationQualityMeta({
    replyText: orchestratedReplyText,
    messageText: payload.text,
    domainIntent: orchestrated.domainIntent,
    routerReason: orchestrated.routerReason,
    nextActions: orchestrated.finalMeta && Array.isArray(orchestrated.finalMeta.committedNextActions)
      ? orchestrated.finalMeta.committedNextActions
      : [],
    opportunityReasonKeys: orchestrated.opportunityDecision ? orchestrated.opportunityDecision.opportunityReasonKeys : [],
    fallbackType: orchestrated.strategyPlan && orchestrated.strategyPlan.fallbackType ? orchestrated.strategyPlan.fallbackType : null,
    legacyTemplateHit: orchestrated.finalMeta && orchestrated.finalMeta.legacyTemplateHit === true,
    pitfallIncluded: orchestrated.finalMeta && orchestrated.finalMeta.pitfallIncluded === true,
    followupQuestionIncluded: orchestrated.finalMeta && orchestrated.finalMeta.followupQuestionIncluded === true,
    conversationNaturalnessVersion: 'v2',
    followupIntent: orchestrated.telemetry ? orchestrated.telemetry.followupIntent : null,
    conciseModeApplied: orchestrated.telemetry ? orchestrated.telemetry.conciseModeApplied === true : false,
    repetitionPrevented: orchestrated.telemetry ? orchestrated.telemetry.repetitionPrevented === true : false,
    directAnswerApplied: orchestrated.telemetry ? orchestrated.telemetry.directAnswerApplied === true : false,
    clarifySuppressed: orchestrated.telemetry ? orchestrated.telemetry.clarifySuppressed === true : false,
    strategyReason: orchestrated.telemetry ? orchestrated.telemetry.strategyReason : null,
    selectedCandidateKind: orchestrated.telemetry ? orchestrated.telemetry.selectedCandidateKind : null,
    selectedByDirectAnswerFirst: orchestrated.telemetry ? orchestrated.telemetry.selectedByDirectAnswerFirst === true : false,
    retrievalBlockedByStrategy: orchestrated.telemetry ? orchestrated.telemetry.retrievalBlockedByStrategy === true : false,
    retrievalBlockReason: orchestrated.telemetry ? orchestrated.telemetry.retrievalBlockReason : null,
    fallbackTemplateKind: orchestrated.telemetry ? orchestrated.telemetry.fallbackTemplateKind : null,
    finalizerTemplateKind: orchestrated.telemetry ? orchestrated.telemetry.finalizerTemplateKind : null,
    replyTemplateFingerprint: orchestrated.telemetry ? orchestrated.telemetry.replyTemplateFingerprint : null,
    priorContextUsed: orchestrated.telemetry ? orchestrated.telemetry.priorContextUsed === true : false,
    followupResolvedFromHistory: orchestrated.telemetry ? orchestrated.telemetry.followupResolvedFromHistory === true : false,
    continuationReason: orchestrated.telemetry ? orchestrated.telemetry.continuationReason : null,
    knowledgeCandidateCountBySource: orchestrated.telemetry ? orchestrated.telemetry.knowledgeCandidateCountBySource : null,
    knowledgeCandidateUsed: orchestrated.telemetry ? orchestrated.telemetry.knowledgeCandidateUsed === true : false,
    knowledgeCandidateRejectedReason: orchestrated.telemetry ? orchestrated.telemetry.knowledgeCandidateRejectedReason : null,
    knowledgeRejectedReasons: orchestrated.telemetry ? orchestrated.telemetry.knowledgeRejectedReasons : [],
    cityPackCandidateAvailable: orchestrated.telemetry ? orchestrated.telemetry.cityPackCandidateAvailable === true : false,
    cityPackRejectedReason: orchestrated.telemetry ? orchestrated.telemetry.cityPackRejectedReason : null,
    cityPackUsedInAnswer: orchestrated.telemetry ? orchestrated.telemetry.cityPackUsedInAnswer === true : false,
    savedFaqCandidateAvailable: orchestrated.telemetry ? orchestrated.telemetry.savedFaqCandidateAvailable === true : false,
    savedFaqRejectedReason: orchestrated.telemetry ? orchestrated.telemetry.savedFaqRejectedReason : null,
    savedFaqUsedInAnswer: orchestrated.telemetry ? orchestrated.telemetry.savedFaqUsedInAnswer === true : false,
    sourceReadinessDecisionSource: orchestrated.telemetry ? orchestrated.telemetry.sourceReadinessDecisionSource : null,
    knowledgeGroundingKind: orchestrated.telemetry ? orchestrated.telemetry.knowledgeGroundingKind : null,
    genericFallbackSlice: orchestrated.telemetry ? orchestrated.telemetry.genericFallbackSlice : null,
    contextCarryScore: orchestrated.telemetry ? orchestrated.telemetry.contextCarryScore : 0,
    repeatRiskScore: orchestrated.telemetry ? orchestrated.telemetry.repeatRiskScore : 0
  });
  const assistantQuality = normalizeAssistantQuality(orchestrated.assistantQuality, {
    intentResolved: payload.paidIntent,
    kbTopScore: 0,
    evidenceCoverage: 0,
    blockedStage: orchestrated.blockedReason ? 'orchestrator' : null,
    fallbackReason: orchestrated.blockedReason || null
  });
  const tokenUsed = (orchestrated.tokensIn || 0) + (orchestrated.tokensOut || 0);
  const usage = await recordLlmUsage({
    userId: payload.lineUserId,
    plan: payload.planInfo.plan,
    subscriptionStatus: payload.planInfo.status,
    intent: payload.paidIntent,
    decision: 'allow',
    blockedReason: null,
    tokensIn: orchestrated.tokensIn || 0,
    tokensOut: orchestrated.tokensOut || 0,
    tokenUsed,
    model: orchestrated.model || (payload.budgetPolicy && payload.budgetPolicy.model),
    assistantQuality
  });
  await appendLlmGateDecisionBestEffort({
    lineUserId: payload.lineUserId,
    plan: payload.planInfo.plan,
    status: payload.planInfo.status,
    intent: payload.paidIntent,
    decision: 'allow',
    blockedReason: null,
    tokenUsed,
    costEstimate: usage && usage.costEstimate,
    model: orchestrated.model || (payload.budgetPolicy && payload.budgetPolicy.model),
    policy: payload.budgetPolicy || null,
    traceId: payload.traceId,
    requestId: payload.requestId,
    conciergeMeta: orchestrated.conciergeMeta,
    assistantQuality,
    conversationMode: orchestrated.conversationMode,
    routerReason: orchestrated.routerReason,
    opportunityType: orchestrated.opportunityDecision ? orchestrated.opportunityDecision.opportunityType : 'none',
    opportunityReasonKeys: orchestrated.opportunityDecision ? orchestrated.opportunityDecision.opportunityReasonKeys : [],
    interventionBudget: orchestrated.opportunityDecision ? orchestrated.opportunityDecision.interventionBudget : 0,
    domainIntent: orchestrated.domainIntent,
    conversationQuality,
    sourceAuthorityScore: orchestrated.telemetry ? orchestrated.telemetry.sourceAuthorityScore : null,
    sourceFreshnessScore: orchestrated.telemetry ? orchestrated.telemetry.sourceFreshnessScore : null,
    sourceReadinessDecision: orchestrated.telemetry ? orchestrated.telemetry.sourceReadinessDecision : null,
    sourceReadinessReasons: orchestrated.telemetry ? orchestrated.telemetry.sourceReadinessReasons : [],
    officialOnlySatisfied: orchestrated.telemetry ? orchestrated.telemetry.officialOnlySatisfied === true : false,
    readinessDecision: orchestrated.telemetry ? orchestrated.telemetry.readinessDecision : null,
    readinessReasonCodes: orchestrated.telemetry ? orchestrated.telemetry.readinessReasonCodes : [],
    readinessSafeResponseMode: orchestrated.telemetry ? orchestrated.telemetry.readinessSafeResponseMode : null,
    unsupportedClaimCount: orchestrated.telemetry ? orchestrated.telemetry.unsupportedClaimCount : 0,
    contradictionDetected: orchestrated.telemetry ? orchestrated.telemetry.contradictionDetected === true : false,
    answerReadinessLogOnly: false,
    answerReadinessLogOnlyV2: orchestrated.telemetry ? orchestrated.telemetry.answerReadinessLogOnlyV2 === true : true,
    answerReadinessEnforcedV2: orchestrated.telemetry ? orchestrated.telemetry.answerReadinessEnforcedV2 === true : false,
    answerReadinessV2Mode: orchestrated.telemetry ? orchestrated.telemetry.answerReadinessV2Mode : null,
    answerReadinessV2Stage: orchestrated.telemetry ? orchestrated.telemetry.answerReadinessV2Stage : null,
    answerReadinessV2EnforcementReason: orchestrated.telemetry
      ? orchestrated.telemetry.answerReadinessV2EnforcementReason
      : null,
    orchestratorPathUsed: orchestrated.telemetry ? orchestrated.telemetry.orchestratorPathUsed === true : true,
    contextResumeDomain: orchestrated.telemetry ? orchestrated.telemetry.contextResumeDomain : null,
    loopBreakApplied: orchestrated.telemetry ? orchestrated.telemetry.loopBreakApplied === true : false,
    followupIntent: orchestrated.telemetry ? orchestrated.telemetry.followupIntent : null,
    conciseModeApplied: orchestrated.telemetry ? orchestrated.telemetry.conciseModeApplied === true : false,
    repetitionPrevented: orchestrated.telemetry ? orchestrated.telemetry.repetitionPrevented === true : false,
    directAnswerApplied: orchestrated.telemetry ? orchestrated.telemetry.directAnswerApplied === true : false,
    clarifySuppressed: orchestrated.telemetry ? orchestrated.telemetry.clarifySuppressed === true : false,
    contextCarryScore: orchestrated.telemetry ? orchestrated.telemetry.contextCarryScore : 0,
    repeatRiskScore: orchestrated.telemetry ? orchestrated.telemetry.repeatRiskScore : 0,
    actionClass: orchestrated.telemetry ? orchestrated.telemetry.actionClass : null,
    actionGatewayEnabled: orchestrated.telemetry ? orchestrated.telemetry.actionGatewayEnabled === true : false,
    actionGatewayEnforced: orchestrated.telemetry ? orchestrated.telemetry.actionGatewayEnforced === true : false,
    actionGatewayAllowed: orchestrated.telemetry ? orchestrated.telemetry.actionGatewayAllowed === true : true,
    actionGatewayDecision: orchestrated.telemetry ? orchestrated.telemetry.actionGatewayDecision : null,
    actionGatewayReason: orchestrated.telemetry ? orchestrated.telemetry.actionGatewayReason : null,
    parentIntentType: orchestrated.telemetry ? orchestrated.telemetry.parentIntentType : null,
    parentAnswerMode: orchestrated.telemetry ? orchestrated.telemetry.parentAnswerMode : null,
    parentLifecycleStage: orchestrated.telemetry ? orchestrated.telemetry.parentLifecycleStage : null,
    parentChapter: orchestrated.telemetry ? orchestrated.telemetry.parentChapter : null,
    parentRoutingInvariantStatus: orchestrated.telemetry ? orchestrated.telemetry.parentRoutingInvariantStatus : null,
    parentRoutingInvariantErrors: orchestrated.telemetry ? orchestrated.telemetry.parentRoutingInvariantErrors : [],
    requiredCoreFactsComplete: orchestrated.telemetry ? orchestrated.telemetry.requiredCoreFactsComplete === true : false,
    missingRequiredCoreFacts: orchestrated.telemetry ? orchestrated.telemetry.missingRequiredCoreFacts : [],
    missingRequiredCoreFactsCount: orchestrated.telemetry ? orchestrated.telemetry.missingRequiredCoreFactsCount : 0,
    requiredCoreFactsCriticalMissingCount: orchestrated.telemetry
      ? orchestrated.telemetry.requiredCoreFactsCriticalMissingCount
      : 0,
    requiredCoreFactsGateDecision: orchestrated.telemetry ? orchestrated.telemetry.requiredCoreFactsGateDecision : null,
    requiredCoreFactsGateLogOnly: orchestrated.telemetry ? orchestrated.telemetry.requiredCoreFactsGateLogOnly === true : false,
    legalSnapshot,
    responseContractConformance: orchestratedReplyEnvelope.responseContractConformance
  });
  await appendLlmActionLogBestEffort({
    lineUserId: payload.lineUserId,
    plan: payload.planInfo.plan,
    traceId: payload.traceId,
    requestId: payload.requestId,
    messageText: payload.text,
    replyText: orchestratedReplyText,
    conciergeMeta: orchestrated.conciergeMeta,
    llmBanditEnabled: payload.llmBanditEnabled,
    conversationMode: orchestrated.conversationMode,
    routerReason: orchestrated.routerReason,
    opportunityType: orchestrated.opportunityDecision ? orchestrated.opportunityDecision.opportunityType : 'none',
    opportunityReasonKeys: orchestrated.opportunityDecision ? orchestrated.opportunityDecision.opportunityReasonKeys : [],
    interventionBudget: orchestrated.opportunityDecision ? orchestrated.opportunityDecision.interventionBudget : 0,
    domainIntent: orchestrated.domainIntent,
    conversationQuality,
    strategy: orchestrated.telemetry ? orchestrated.telemetry.strategy : null,
    retrieveNeeded: orchestrated.telemetry ? orchestrated.telemetry.retrieveNeeded === true : false,
    retrievalQuality: orchestrated.telemetry ? orchestrated.telemetry.retrievalQuality : null,
    judgeWinner: orchestrated.telemetry ? orchestrated.telemetry.judgeWinner : null,
    judgeScores: orchestrated.telemetry ? orchestrated.telemetry.judgeScores : [],
    verificationOutcome: orchestrated.telemetry ? orchestrated.telemetry.verificationOutcome : null,
    contradictionFlags: orchestrated.telemetry ? orchestrated.telemetry.contradictionFlags : [],
    requestShape: orchestrated.telemetry ? orchestrated.telemetry.requestShape : null,
    depthIntent: orchestrated.telemetry ? orchestrated.telemetry.depthIntent : null,
    transformSource: orchestrated.telemetry ? orchestrated.telemetry.transformSource : null,
    outputForm: orchestrated.telemetry ? orchestrated.telemetry.outputForm : null,
    knowledgeScope: orchestrated.telemetry ? orchestrated.telemetry.knowledgeScope : null,
    locationHintKind: orchestrated.telemetry ? orchestrated.telemetry.locationHintKind : null,
    locationHintCityKey: orchestrated.telemetry ? orchestrated.telemetry.locationHintCityKey : null,
    locationHintState: orchestrated.telemetry ? orchestrated.telemetry.locationHintState : null,
    locationHintRegionKey: orchestrated.telemetry ? orchestrated.telemetry.locationHintRegionKey : null,
    detailObligations: orchestrated.telemetry ? orchestrated.telemetry.detailObligations : [],
    answerability: orchestrated.telemetry ? orchestrated.telemetry.answerability : null,
    echoOfPriorAssistant: orchestrated.telemetry
      ? (typeof orchestrated.telemetry.echoOfPriorAssistant === 'boolean' ? orchestrated.telemetry.echoOfPriorAssistant : null)
      : null,
    requestedCityKey: orchestrated.telemetry ? orchestrated.telemetry.requestedCityKey : null,
    matchedCityKey: orchestrated.telemetry ? orchestrated.telemetry.matchedCityKey : null,
    citySpecificitySatisfied: orchestrated.telemetry ? orchestrated.telemetry.citySpecificitySatisfied === true : null,
    citySpecificityReason: orchestrated.telemetry ? orchestrated.telemetry.citySpecificityReason : null,
    scopeDisclosureRequired: orchestrated.telemetry ? orchestrated.telemetry.scopeDisclosureRequired === true : null,
    violationCodes: orchestrated.telemetry ? orchestrated.telemetry.violationCodes : [],
    candidateCount: orchestrated.telemetry ? orchestrated.telemetry.candidateCount : 0,
    sourceAuthorityScore: orchestrated.telemetry ? orchestrated.telemetry.sourceAuthorityScore : null,
    sourceFreshnessScore: orchestrated.telemetry ? orchestrated.telemetry.sourceFreshnessScore : null,
    sourceReadinessDecision: orchestrated.telemetry ? orchestrated.telemetry.sourceReadinessDecision : null,
    sourceReadinessReasons: orchestrated.telemetry ? orchestrated.telemetry.sourceReadinessReasons : [],
    officialOnlySatisfied: orchestrated.telemetry ? orchestrated.telemetry.officialOnlySatisfied === true : false,
    readinessDecision: orchestrated.telemetry ? orchestrated.telemetry.readinessDecision : null,
    readinessReasonCodes: orchestrated.telemetry ? orchestrated.telemetry.readinessReasonCodes : [],
    readinessSafeResponseMode: orchestrated.telemetry ? orchestrated.telemetry.readinessSafeResponseMode : null,
    unsupportedClaimCount: orchestrated.telemetry ? orchestrated.telemetry.unsupportedClaimCount : 0,
    contradictionDetected: orchestrated.telemetry ? orchestrated.telemetry.contradictionDetected === true : false,
    answerReadinessLogOnly: false,
    answerReadinessLogOnlyV2: orchestrated.telemetry ? orchestrated.telemetry.answerReadinessLogOnlyV2 === true : true,
    answerReadinessEnforcedV2: orchestrated.telemetry ? orchestrated.telemetry.answerReadinessEnforcedV2 === true : false,
    answerReadinessV2Mode: orchestrated.telemetry ? orchestrated.telemetry.answerReadinessV2Mode : null,
    answerReadinessV2Stage: orchestrated.telemetry ? orchestrated.telemetry.answerReadinessV2Stage : null,
    answerReadinessV2EnforcementReason: orchestrated.telemetry
      ? orchestrated.telemetry.answerReadinessV2EnforcementReason
      : null,
    orchestratorPathUsed: orchestrated.telemetry ? orchestrated.telemetry.orchestratorPathUsed === true : true,
    contextResumeDomain: orchestrated.telemetry ? orchestrated.telemetry.contextResumeDomain : null,
    loopBreakApplied: orchestrated.telemetry ? orchestrated.telemetry.loopBreakApplied === true : false,
    followupIntent: orchestrated.telemetry ? orchestrated.telemetry.followupIntent : null,
    conciseModeApplied: orchestrated.telemetry ? orchestrated.telemetry.conciseModeApplied === true : false,
    repetitionPrevented: orchestrated.telemetry ? orchestrated.telemetry.repetitionPrevented === true : false,
    directAnswerApplied: orchestrated.telemetry ? orchestrated.telemetry.directAnswerApplied === true : false,
    clarifySuppressed: orchestrated.telemetry ? orchestrated.telemetry.clarifySuppressed === true : false,
    contextCarryScore: orchestrated.telemetry ? orchestrated.telemetry.contextCarryScore : 0,
    repeatRiskScore: orchestrated.telemetry ? orchestrated.telemetry.repeatRiskScore : 0,
    actionClass: orchestrated.telemetry ? orchestrated.telemetry.actionClass : null,
    actionGatewayEnabled: orchestrated.telemetry ? orchestrated.telemetry.actionGatewayEnabled === true : false,
    actionGatewayEnforced: orchestrated.telemetry ? orchestrated.telemetry.actionGatewayEnforced === true : false,
    actionGatewayAllowed: orchestrated.telemetry ? orchestrated.telemetry.actionGatewayAllowed === true : true,
    actionGatewayDecision: orchestrated.telemetry ? orchestrated.telemetry.actionGatewayDecision : null,
    actionGatewayReason: orchestrated.telemetry ? orchestrated.telemetry.actionGatewayReason : null,
    parentIntentType: orchestrated.telemetry ? orchestrated.telemetry.parentIntentType : null,
    parentAnswerMode: orchestrated.telemetry ? orchestrated.telemetry.parentAnswerMode : null,
    parentLifecycleStage: orchestrated.telemetry ? orchestrated.telemetry.parentLifecycleStage : null,
    parentChapter: orchestrated.telemetry ? orchestrated.telemetry.parentChapter : null,
    parentRoutingInvariantStatus: orchestrated.telemetry ? orchestrated.telemetry.parentRoutingInvariantStatus : null,
    parentRoutingInvariantErrors: orchestrated.telemetry ? orchestrated.telemetry.parentRoutingInvariantErrors : [],
    requiredCoreFactsComplete: orchestrated.telemetry ? orchestrated.telemetry.requiredCoreFactsComplete === true : false,
    missingRequiredCoreFacts: orchestrated.telemetry ? orchestrated.telemetry.missingRequiredCoreFacts : [],
    missingRequiredCoreFactsCount: orchestrated.telemetry ? orchestrated.telemetry.missingRequiredCoreFactsCount : 0,
    requiredCoreFactsCriticalMissingCount: orchestrated.telemetry
      ? orchestrated.telemetry.requiredCoreFactsCriticalMissingCount
      : 0,
    requiredCoreFactsGateDecision: orchestrated.telemetry ? orchestrated.telemetry.requiredCoreFactsGateDecision : null,
    requiredCoreFactsGateLogOnly: orchestrated.telemetry ? orchestrated.telemetry.requiredCoreFactsGateLogOnly === true : false,
    committedNextActions: orchestrated.telemetry ? orchestrated.telemetry.committedNextActions : [],
    committedFollowupQuestion: orchestrated.telemetry ? orchestrated.telemetry.committedFollowupQuestion : null,
    recentUserGoal: Array.isArray(orchestrated.packet && orchestrated.packet.recentUserGoals)
      ? (orchestrated.packet.recentUserGoals[0] || null)
      : null,
    contextSnapshot: payload.contextSnapshot || null,
    responseContractConformance: orchestratedReplyEnvelope.responseContractConformance
  });
  await appendJourneyEventBestEffort({
    lineUserId: payload.lineUserId,
    type: 'next_action_shown',
    intent: payload.paidIntent,
    phase: payload.contextSnapshot && payload.contextSnapshot.phase ? payload.contextSnapshot.phase : null,
    nextActions: orchestrated.finalMeta && Array.isArray(orchestrated.finalMeta.committedNextActions)
      ? orchestrated.finalMeta.committedNextActions
      : [],
    evidenceKeys: [],
    summary: orchestratedReplyText.split('\n')[0] || null,
    createdAt: new Date().toISOString()
  });

  return {
    handled: true,
    mode: 'paid_orchestrated',
    blockedReason: null,
    strategy: orchestrated.telemetry ? orchestrated.telemetry.strategy : null
  };
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
  const sanitizeLegacyTemplateForPaid = payload.sanitizeLegacyTemplateForPaid === true;
  const domainIntent = normalizeDomainIntent(payload.domainIntent);
  const contextualFollowup = payload.enableContextualFollowup === true
    ? resolveFreeContextualFollowup({
      messageText: payload.text,
      messageDomainIntent: payload.normalizedConversationIntent || payload.domainIntent,
      recentActionRows: payload.recentActionRows
    })
    : null;
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
  let replyText = extra ? trimForLineMessage(`${base}\n\n${extra}`) : base;
  if (contextualFollowup && contextualFollowup.replyText) {
    replyText = extra
      ? trimForLineMessage(`${contextualFollowup.replyText}\n\n${extra}`)
      : trimForLineMessage(contextualFollowup.replyText);
  }
  const retrievalBlockedReasons = Array.isArray(retrieval.blockedReasons) ? retrieval.blockedReasons : [];
  const retrievalInjectionFindings = retrieval.injectionFindings === true;
  let conciergeMeta = {
    topic: null,
    mode: null,
    userTier: payload.plan === 'pro' ? 'paid' : 'free',
    citationRanks: [],
    urlCount: 0,
    urls: [],
    guardDecisions: [],
    blockedReasons: retrievalBlockedReasons,
    injectionFindings: retrievalInjectionFindings,
    evidenceNeed: 'none',
    evidenceOutcome: retrievalInjectionFindings || retrievalBlockedReasons.length ? 'BLOCKED' : 'SUPPORTED',
    chosenAction: null,
    contextVersion: 'concierge_ctx_v1',
    featureHash: null,
    postRenderLint: { findings: [], modified: false },
    contextSignature: null,
    contextualBanditEnabled: false,
    contextualFeatures: null,
    counterfactualSelectedArmId: null,
    counterfactualSelectedRank: null,
    counterfactualTopArms: [],
    counterfactualEval: null
  };

  if (payload.llmConciergeEnabled === true) {
    try {
      const [faqStored, cityPackStored] = await Promise.all([
        resolveFaqStoredCandidatesFromRetrieval(retrieval),
        resolveCityPackStoredCandidatesFromRetrieval(retrieval)
      ]);
      const concierge = await composeConciergeReply({
        question: payload.text,
        baseReplyText: replyText,
        legalSnapshot: payload.legalSnapshot || null,
        domainIntent,
        intentRiskTier: resolveIntentRiskTier({ domainIntent }).intentRiskTier,
        userTier: payload.plan === 'pro' ? 'paid' : 'free',
        plan: payload.plan || 'free',
        locale: 'ja',
        contextSnapshot: payload.contextSnapshot || null,
        storedCandidates: faqStored.concat(cityPackStored),
        denylist: payload.llmPolicy && Array.isArray(payload.llmPolicy.forbidden_domains)
          ? payload.llmPolicy.forbidden_domains
          : [],
        webSearchEnabled: payload.llmWebSearchEnabled === true,
        styleEngineEnabled: payload.llmStyleEngineEnabled !== false,
        bandit: {
          enabled: payload.llmBanditEnabled === true,
          epsilon: 0.1,
          stateFetcher: async ({ segmentKey, contextSignature }) => {
            const [stateByArm, contextualStateByArm] = await Promise.all([
              loadBanditStateByArm(segmentKey),
              loadContextualBanditStateByArm(segmentKey, contextSignature)
            ]);
            return { stateByArm, contextualStateByArm };
          }
        },
        env: process.env
      });
      replyText = concierge && concierge.replyText ? concierge.replyText : replyText;
      conciergeMeta = concierge && concierge.auditMeta ? concierge.auditMeta : conciergeMeta;
    } catch (_err) {
      // fail closed: keep retrieval-only reply text
      conciergeMeta = {
        topic: null,
        mode: null,
        userTier: payload.plan === 'pro' ? 'paid' : 'free',
        citationRanks: [],
        urlCount: 0,
        urls: [],
        guardDecisions: [],
        blockedReasons: Array.from(new Set(retrievalBlockedReasons.concat(['concierge_compose_failed']))),
        injectionFindings: retrievalInjectionFindings,
        evidenceNeed: 'none',
        evidenceOutcome: 'BLOCKED',
        chosenAction: null,
        contextVersion: 'concierge_ctx_v1',
        featureHash: null,
        postRenderLint: { findings: [], modified: false },
        contextSignature: null,
        contextualBanditEnabled: false,
        contextualFeatures: null,
        counterfactualSelectedArmId: null,
        counterfactualSelectedRank: null,
        counterfactualTopArms: [],
        counterfactualEval: null
      };
    }
  }

  if (sanitizeLegacyTemplateForPaid) {
    const sanitizedText = stripLegacyTemplateTokensForPaid(replyText);
    if (sanitizedText) replyText = sanitizedText;
    replyText = trimForPaidLineMessage(replyText);
  }

  const semanticReplyEnvelope = buildSemanticReplyEnvelope({
    replyText,
    domainIntent,
    conversationMode: payload.plan === 'pro' ? 'concierge' : 'casual',
    eventSource: payload.eventSource,
    pathType: 'slow',
    uUnits: ['U-05', 'U-06', 'U-09', 'U-10', 'U-11', 'U-16', 'U-17'],
    nextSteps: [],
    followupQuestion: contextualFollowup && typeof contextualFollowup.replyText === 'string'
      ? contextualFollowup.replyText
      : null,
    warnings: conciergeMeta && Array.isArray(conciergeMeta.blockedReasons)
      ? conciergeMeta.blockedReasons
      : [],
    legalSnapshot: payload.legalSnapshot || null,
    sourceAuthorityScore: conciergeMeta && Number.isFinite(Number(conciergeMeta.sourceAuthorityScore))
      ? Number(conciergeMeta.sourceAuthorityScore)
      : null,
    sourceFreshnessScore: conciergeMeta && Number.isFinite(Number(conciergeMeta.sourceFreshnessScore))
      ? Number(conciergeMeta.sourceFreshnessScore)
      : null,
    sourceReadinessDecision: conciergeMeta && typeof conciergeMeta.sourceReadinessDecision === 'string'
      ? conciergeMeta.sourceReadinessDecision
      : null,
    officialOnlySatisfied: conciergeMeta ? conciergeMeta.officialOnlySatisfied === true : false,
    readinessDecision: conciergeMeta && typeof conciergeMeta.readinessDecision === 'string'
      ? conciergeMeta.readinessDecision
      : null,
    readinessReasonCodes: conciergeMeta && Array.isArray(conciergeMeta.readinessReasonCodes)
      ? conciergeMeta.readinessReasonCodes
      : []
  });
  replyText = semanticReplyEnvelope.replyText;
  await payload.replyFn(
    payload.replyToken,
    semanticReplyEnvelope.lineMessage || { type: 'text', text: replyText }
  );
  const conversationQuality = buildConversationQualityMeta({
    replyText,
    domainIntent,
    fallbackType: sanitizeLegacyTemplateForPaid
      ? 'free_retrieval_sanitized'
      : (contextualFollowup ? 'free_contextual_followup' : 'free_retrieval'),
    opportunityReasonKeys: [],
    followupIntent: contextualFollowup ? contextualFollowup.followupIntent : null,
    conciseModeApplied: contextualFollowup ? contextualFollowup.qualityMeta.conciseModeApplied === true : false,
    directAnswerApplied: contextualFollowup ? contextualFollowup.qualityMeta.directAnswerApplied === true : false,
    clarifySuppressed: contextualFollowup ? contextualFollowup.qualityMeta.clarifySuppressed === true : false,
    repetitionPrevented: contextualFollowup ? contextualFollowup.qualityMeta.repetitionPrevented === true : false,
    contextCarryScore: contextualFollowup ? contextualFollowup.qualityMeta.contextCarryScore : 0,
    repeatRiskScore: contextualFollowup ? contextualFollowup.qualityMeta.repeatRiskScore : 0
  });
  return Object.assign({}, retrieval, {
    replyText,
    followupIntent: contextualFollowup ? contextualFollowup.followupIntent : null,
    contextualFollowupUsed: Boolean(contextualFollowup),
    conciergeMeta,
    conversationQuality,
    responseContractConformance: semanticReplyEnvelope.responseContractConformance,
    semanticResponseObject: semanticReplyEnvelope.semanticResponseObject
  });
}

async function handleAssistantMessage(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = payload.lineUserId;
  const text = normalizeReplyText(payload.text);
  if (!lineUserId || !text || !payload.replyToken || typeof payload.replyFn !== 'function') {
    return { handled: false };
  }

  const planInfo = await resolvePlan(lineUserId);
  const llmConciergeEnabled = payload.llmConciergeEnabled === true;
  const llmWebSearchEnabled = payload.llmWebSearchEnabled !== false;
  const llmStyleEngineEnabled = payload.llmStyleEngineEnabled !== false;
  const llmBanditEnabled = payload.llmBanditEnabled === true;
  const opportunityEngineEnabled = resolvePaidOpportunityEngineEnabled();
  const normalizedConversationIntent = normalizeConversationIntent(text);
  const explicitPaidIntent = detectExplicitPaidIntent(text);
  const paidIntent = classifyPaidIntent(text);
  const traceId = typeof payload.requestId === 'string' && payload.requestId.trim()
    ? payload.requestId.trim()
    : null;
  const requestId = traceId;
  const banditStateFetcher = async ({ segmentKey, contextSignature }) => {
    if (llmBanditEnabled !== true) return {};
    const [stateByArm, contextualStateByArm] = await Promise.all([
      loadBanditStateByArm(segmentKey),
      loadContextualBanditStateByArm(segmentKey, contextSignature)
    ]);
    return {
      stateByArm,
      contextualStateByArm
    };
  };

  if (planInfo.plan !== 'pro') {
    const blockedReason = explicitPaidIntent ? 'plan_free' : 'free_retrieval_only';
    const assistantQuality = normalizeAssistantQuality(null, {
      intentResolved: paidIntent,
      kbTopScore: 0,
      evidenceCoverage: 0,
      blockedStage: 'plan_gate',
      fallbackReason: blockedReason
    });
    const dependencyHint = isDependencyHintIntent(text)
      ? buildFreeDependencyHint(await loadTaskGraphSummary(lineUserId))
      : '';
    const recentActionRows = await loadRecentActionRowsBestEffort(lineUserId, 5);
    const fallback = await replyWithFreeRetrieval(Object.assign({}, payload, {
      extraText: dependencyHint,
      blockedReason,
      plan: planInfo.plan,
      domainIntent: normalizedConversationIntent,
      llmConciergeEnabled,
      llmWebSearchEnabled,
      llmStyleEngineEnabled,
      llmBanditEnabled,
      normalizedConversationIntent,
      recentActionRows,
      enableContextualFollowup: true
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
      tokenUsed: 0,
      assistantQuality
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
      requestId,
      conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
      assistantQuality,
      domainIntent: normalizedConversationIntent,
      conversationQuality: fallback && fallback.conversationQuality ? fallback.conversationQuality : buildConversationQualityMeta({
        replyText: fallback && fallback.replyText ? fallback.replyText : '',
        domainIntent: normalizedConversationIntent,
        fallbackType: blockedReason || 'free_retrieval_only',
        opportunityReasonKeys: []
      })
    });
    await appendLlmActionLogBestEffort({
      lineUserId,
      plan: planInfo.plan,
      traceId,
      requestId,
      replyText: fallback && fallback.replyText ? fallback.replyText : '',
      conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
      llmBanditEnabled,
      domainIntent: normalizedConversationIntent,
      conversationQuality: fallback && fallback.conversationQuality ? fallback.conversationQuality : buildConversationQualityMeta({
        replyText: fallback && fallback.replyText ? fallback.replyText : '',
        domainIntent: normalizedConversationIntent,
        fallbackType: blockedReason || 'free_retrieval_only',
        opportunityReasonKeys: []
      })
    });
    return {
      handled: true,
      mode: 'free_retrieval',
      fallback,
      blockedReason
    };
  }

  const conversationRouterEnabled = resolveConversationRouterEnabled();
  const routerDecision = conversationRouterEnabled
    ? routeConversation(text, {
      userTier: 'paid',
      llmConciergeEnabled
    })
    : null;
  const routerMode = routerDecision && typeof routerDecision.mode === 'string'
    ? routerDecision.mode
    : null;
  const isPaidDomainIntent = planInfo.plan === 'pro' && PAID_CONCIERGE_DOMAIN_INTENTS.has(normalizedConversationIntent);
  const routerReason = isPaidDomainIntent
    ? `${normalizedConversationIntent}_intent_detected`
    : (routerDecision && typeof routerDecision.reason === 'string'
    ? routerDecision.reason
    : null);
  const paidOrchestratorEnabled = resolvePaidOrchestratorEnabled();
  const shouldRouteToPaidCasual = conversationRouterEnabled && (routerMode === 'greeting' || routerMode === 'casual');

  if (paidOrchestratorEnabled && shouldRouteToPaidCasual) {
    const earlyOrchestrated = await tryHandlePaidOrchestratorV2({
      lineUserId,
      text,
      replyToken: payload.replyToken,
      replyFn: payload.replyFn,
      planInfo,
      explicitPaidIntent,
      paidIntent,
      routerMode,
      routerReason,
      normalizedConversationIntent,
      contextSnapshot: null,
      llmConciergeEnabled,
      llmWebSearchEnabled,
      llmStyleEngineEnabled,
      llmBanditEnabled,
      qualityEnabled: resolvePaidFaqQualityEnabled(),
      snapshotStrictMode: resolveSnapshotOnlyContextEnabled(),
      maxNextActionsCap: 3,
      recentEngagement: {
        recentTurns: 0,
        recentInterventions: 0,
        recentClicks: false,
        recentTaskDone: false
      },
      opportunityDecision: withRouterReasonOnOpportunityDecision(buildDefaultOpportunityDecision(), routerReason),
      budgetPolicy: null,
      banditStateFetcher,
      traceId,
      requestId
    });
    if (earlyOrchestrated && earlyOrchestrated.handled === true) return earlyOrchestrated;
  }

  if (shouldRouteToPaidCasual && !paidOrchestratorEnabled) {
    const casual = generatePaidCasualReply({
      messageText: text,
      contextHint: normalizedConversationIntent !== 'general' ? normalizedConversationIntent : '',
      followupIntent: null,
      recentResponseHints: [],
      suggestedAtoms: { nextActions: [], pitfall: null, question: null }
    });
    const guardedReply = guardPaidMainReplyText(casual && casual.replyText ? casual.replyText : 'こんにちは。', {
      situationLine: casual && casual.replyText ? casual.replyText : 'こんにちは。',
      nextActions: [],
      pitfall: '',
      followupQuestion: '',
      defaultQuestion: '',
      preserveReplyText: true,
      disablePitfall: true,
      disableFollowup: true
    });
    const semanticReplyEnvelope = buildSemanticReplyEnvelope({
      replyText: guardedReply.replyText,
      domainIntent: normalizedConversationIntent,
      conversationMode: 'casual',
      eventSource: payload.eventSource,
      pathType: 'fast',
      uUnits: ['U-02', 'U-17', 'U-26', 'U-27'],
      nextSteps: [],
      followupQuestion: null
    });
    const replyText = normalizeReplyText(casual && casual.replyText ? casual.replyText : '') || guardedReply.replyText;
    await payload.replyFn(
      payload.replyToken,
      { type: 'text', text: replyText }
    );
    const assistantQuality = normalizeAssistantQuality(null, {
      intentResolved: paidIntent,
      kbTopScore: 0,
      evidenceCoverage: 0,
      blockedStage: null,
      fallbackReason: null
    });
    const conversationQuality = buildConversationQualityMeta({
      replyText,
      domainIntent: normalizedConversationIntent,
      opportunityReasonKeys: routerReason ? [routerReason] : [],
      fallbackType: null,
      legacyTemplateHit: guardedReply.legacyTemplateHit === true,
      pitfallIncluded: guardedReply.pitfallIncluded === true,
      followupQuestionIncluded: guardedReply.followupQuestionIncluded === true
    });
    const usage = await recordLlmUsage({
      userId: lineUserId,
      plan: planInfo.plan,
      subscriptionStatus: planInfo.status,
      intent: paidIntent,
      decision: 'allow',
      blockedReason: null,
      tokensIn: 0,
      tokensOut: 0,
      tokenUsed: 0,
      model: null,
      assistantQuality
    });
    await appendLlmGateDecisionBestEffort({
      lineUserId,
      plan: planInfo.plan,
      status: planInfo.status,
      intent: paidIntent,
      decision: 'allow',
      blockedReason: null,
      tokenUsed: 0,
      costEstimate: usage && usage.costEstimate,
      model: null,
      traceId,
      requestId,
      assistantQuality,
      conversationMode: 'casual',
      routerReason: routerReason || 'router_casual',
      opportunityType: 'none',
      opportunityReasonKeys: routerReason ? [routerReason] : [],
      interventionBudget: 0,
      domainIntent: normalizedConversationIntent,
      conversationQuality,
      responseContractConformance: semanticReplyEnvelope.responseContractConformance
    });
    await appendLlmActionLogBestEffort({
      lineUserId,
      plan: planInfo.plan,
      traceId,
      requestId,
      replyText,
      llmBanditEnabled,
      conversationMode: 'casual',
      routerReason: routerReason || 'router_casual',
      opportunityType: 'none',
      opportunityReasonKeys: routerReason ? [routerReason] : [],
      interventionBudget: 0,
      responseContractConformance: semanticReplyEnvelope.responseContractConformance
    });
    return {
      handled: true,
      mode: 'paid_router_casual',
      blockedReason: null
    };
  }

  const budget = await evaluateLLMBudget(lineUserId, {
    intent: paidIntent,
    tokenEstimate: 0,
    planInfo
  });

  if (!budget.allowed) {
    const blockedReason = budget.blockedReason || 'plan_gate_blocked';
    const assistantQuality = normalizeAssistantQuality(null, {
      intentResolved: paidIntent,
      kbTopScore: 0,
      evidenceCoverage: 0,
      blockedStage: 'budget_gate',
      fallbackReason: blockedReason
    });
    const fallback = await replyWithPaidDomainConcierge(Object.assign({}, payload, {
      blockedReason,
      domainIntent: isPaidDomainIntent ? normalizedConversationIntent : 'general',
      forceConcierge: true
    }));
    const fallbackDecision = fallback && fallback.opportunityDecision ? fallback.opportunityDecision : null;
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
      assistantQuality
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
      requestId,
      conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
      assistantQuality,
      conversationMode: 'concierge',
      routerReason: routerReason || 'paid_fallback_concierge',
      opportunityType: fallbackDecision ? fallbackDecision.opportunityType : 'none',
      opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : [],
      interventionBudget: 1,
      followupIntent: fallback && typeof fallback.followupIntent === 'string' ? fallback.followupIntent : null,
      conciseModeApplied: fallback ? fallback.conciseModeApplied === true : false,
      repetitionPrevented: false,
      domainIntent: normalizedConversationIntent,
      conversationQuality: fallback && fallback.conversationQuality ? fallback.conversationQuality : buildConversationQualityMeta({
        replyText: fallback && fallback.replyText ? fallback.replyText : '',
        domainIntent: normalizedConversationIntent,
        fallbackType: 'budget_blocked_fallback',
        opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : []
      })
    });
    await appendLlmActionLogBestEffort({
      lineUserId,
      plan: planInfo.plan,
      traceId,
      requestId,
      replyText: fallback && fallback.replyText ? fallback.replyText : '',
      conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
      llmBanditEnabled,
      conversationMode: 'concierge',
      routerReason: routerReason || 'paid_fallback_concierge',
      opportunityType: fallbackDecision ? fallbackDecision.opportunityType : 'none',
      opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : [],
      interventionBudget: 1,
      followupIntent: fallback && typeof fallback.followupIntent === 'string' ? fallback.followupIntent : null,
      conciseModeApplied: fallback ? fallback.conciseModeApplied === true : false,
      repetitionPrevented: false,
      domainIntent: normalizedConversationIntent,
      conversationQuality: fallback && fallback.conversationQuality ? fallback.conversationQuality : buildConversationQualityMeta({
        replyText: fallback && fallback.replyText ? fallback.replyText : '',
        domainIntent: normalizedConversationIntent,
        fallbackType: 'budget_blocked_fallback',
        opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : []
      })
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
    const assistantQuality = normalizeAssistantQuality(null, {
      intentResolved: paidIntent,
      kbTopScore: 0,
      evidenceCoverage: 0,
      blockedStage: 'availability_gate',
      fallbackReason: blockedReason
    });
    const fallback = await replyWithPaidDomainConcierge(Object.assign({}, payload, {
      blockedReason,
      domainIntent: isPaidDomainIntent ? normalizedConversationIntent : 'general',
      forceConcierge: true
    }));
    const fallbackDecision = fallback && fallback.opportunityDecision ? fallback.opportunityDecision : null;
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
      model: budget.policy && budget.policy.model,
      assistantQuality
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
      requestId,
      conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
      assistantQuality,
      conversationMode: 'concierge',
      routerReason: routerReason || 'paid_fallback_concierge',
      opportunityType: fallbackDecision ? fallbackDecision.opportunityType : 'none',
      opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : [],
      interventionBudget: 1,
      followupIntent: fallback && typeof fallback.followupIntent === 'string' ? fallback.followupIntent : null,
      conciseModeApplied: fallback ? fallback.conciseModeApplied === true : false,
      repetitionPrevented: false,
      domainIntent: normalizedConversationIntent,
      conversationQuality: fallback && fallback.conversationQuality ? fallback.conversationQuality : buildConversationQualityMeta({
        replyText: fallback && fallback.replyText ? fallback.replyText : '',
        domainIntent: normalizedConversationIntent,
        fallbackType: 'availability_blocked_fallback',
        opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : []
      })
    });
    await appendLlmActionLogBestEffort({
      lineUserId,
      plan: planInfo.plan,
      traceId,
      requestId,
      replyText: fallback && fallback.replyText ? fallback.replyText : '',
      conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
      llmBanditEnabled,
      conversationMode: 'concierge',
      routerReason: routerReason || 'paid_fallback_concierge',
      opportunityType: fallbackDecision ? fallbackDecision.opportunityType : 'none',
      opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : [],
      interventionBudget: 1,
      followupIntent: fallback && typeof fallback.followupIntent === 'string' ? fallback.followupIntent : null,
      conciseModeApplied: fallback ? fallback.conciseModeApplied === true : false,
      repetitionPrevented: false,
      domainIntent: normalizedConversationIntent,
      conversationQuality: fallback && fallback.conversationQuality ? fallback.conversationQuality : buildConversationQualityMeta({
        replyText: fallback && fallback.replyText ? fallback.replyText : '',
        domainIntent: normalizedConversationIntent,
        fallbackType: 'availability_blocked_fallback',
        opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : []
      })
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
    const assistantQuality = normalizeAssistantQuality(null, {
      intentResolved: paidIntent,
      kbTopScore: 0,
      evidenceCoverage: 0,
      blockedStage: 'snapshot_gate',
      fallbackReason: blockedReason
    });
    const fallback = await replyWithPaidDomainConcierge(Object.assign({}, payload, {
      blockedReason,
      domainIntent: isPaidDomainIntent ? normalizedConversationIntent : 'general',
      forceConcierge: true
    }));
    const fallbackDecision = fallback && fallback.opportunityDecision ? fallback.opportunityDecision : null;
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
      model: budget.policy && budget.policy.model,
      assistantQuality
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
      requestId,
      conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
      assistantQuality,
      conversationMode: 'concierge',
      routerReason: routerReason || 'paid_fallback_concierge',
      opportunityType: fallbackDecision ? fallbackDecision.opportunityType : 'none',
      opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : [],
      interventionBudget: 1,
      followupIntent: fallback && typeof fallback.followupIntent === 'string' ? fallback.followupIntent : null,
      conciseModeApplied: fallback ? fallback.conciseModeApplied === true : false,
      repetitionPrevented: false,
      domainIntent: normalizedConversationIntent,
      conversationQuality: fallback && fallback.conversationQuality ? fallback.conversationQuality : buildConversationQualityMeta({
        replyText: fallback && fallback.replyText ? fallback.replyText : '',
        domainIntent: normalizedConversationIntent,
        fallbackType: 'snapshot_blocked_fallback',
        opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : []
      })
    });
    await appendLlmActionLogBestEffort({
      lineUserId,
      plan: planInfo.plan,
      traceId,
      requestId,
      replyText: fallback && fallback.replyText ? fallback.replyText : '',
      conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
      llmBanditEnabled,
      conversationMode: 'concierge',
      routerReason: routerReason || 'paid_fallback_concierge',
      opportunityType: fallbackDecision ? fallbackDecision.opportunityType : 'none',
      opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : [],
      interventionBudget: 1,
      followupIntent: fallback && typeof fallback.followupIntent === 'string' ? fallback.followupIntent : null,
      conciseModeApplied: fallback ? fallback.conciseModeApplied === true : false,
      repetitionPrevented: false,
      domainIntent: normalizedConversationIntent,
      conversationQuality: fallback && fallback.conversationQuality ? fallback.conversationQuality : buildConversationQualityMeta({
        replyText: fallback && fallback.replyText ? fallback.replyText : '',
        domainIntent: normalizedConversationIntent,
        fallbackType: 'snapshot_blocked_fallback',
        opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : []
      })
    });
    return {
      handled: true,
      mode: 'snapshot_blocked_fallback',
      fallback,
      blockedReason
    };
  }

  const qualityEnabled = resolvePaidFaqQualityEnabled();
  const actionGatewayEnabled = resolveV1ActionGatewayEnabled();
  const contextSnapshot = snapshotResult && snapshotResult.ok === true && snapshotResult.stale !== true
    ? snapshotResult.snapshot
    : null;
  let opportunityDecision = buildDefaultOpportunityDecision();
  let recentEngagement = {
    recentTurns: 0,
    recentInterventions: 0,
    recentClicks: false,
    recentTaskDone: false
  };
  const messagePosture = detectMessagePosture({ messageText: text });
  const greetingOrSmalltalk = messagePosture.isGreeting === true || messagePosture.isSmalltalk === true;
  const runRouterOpportunityPath = conversationRouterEnabled
    && opportunityEngineEnabled
    && (routerMode === 'problem' || routerMode === 'question');
  if (isPaidDomainIntent) {
    const recentTurns = resolvePaidInterventionCooldownTurns();
    recentEngagement = await loadRecentInterventionSignals({
      lineUserId,
      recentTurns
    }).catch(() => ({
      recentTurns,
      recentInterventions: 0,
      recentClicks: false,
      recentTaskDone: false
    }));
    opportunityDecision = detectOpportunity(buildOpportunityInput({
      lineUserId,
      userTier: 'paid',
      messageText: text,
      contextSnapshot,
      recentEngagement,
      llmConciergeEnabled: true
    }));
  } else if (!conversationRouterEnabled && greetingOrSmalltalk) {
    opportunityDecision = detectOpportunity(buildOpportunityInput({
      lineUserId,
      userTier: 'paid',
      messageText: text,
      contextSnapshot,
      recentEngagement,
      llmConciergeEnabled
    }));
  } else if (!conversationRouterEnabled && opportunityEngineEnabled) {
    const recentTurns = resolvePaidInterventionCooldownTurns();
    recentEngagement = await loadRecentInterventionSignals({
      lineUserId,
      recentTurns
    });
    opportunityDecision = detectOpportunity(buildOpportunityInput({
      lineUserId,
      userTier: 'paid',
      messageText: text,
      contextSnapshot,
      recentEngagement,
      llmConciergeEnabled
    }));
  } else if (runRouterOpportunityPath) {
    const recentTurns = resolvePaidInterventionCooldownTurns();
    recentEngagement = await loadRecentInterventionSignals({
      lineUserId,
      recentTurns
    });
    opportunityDecision = detectOpportunity(buildOpportunityInput({
      lineUserId,
      userTier: 'paid',
      messageText: text,
      contextSnapshot,
      recentEngagement,
      llmConciergeEnabled
    }));
  }
  const maxNextActionsCap = await resolveMaxNextActionsCapFromJourneyCatalog(planInfo);
  const skipLegacyGreetingOrchestrator = !conversationRouterEnabled && greetingOrSmalltalk === true;
  if (!skipLegacyGreetingOrchestrator) {
    const orchestrated = await tryHandlePaidOrchestratorV2({
      lineUserId,
      text,
      replyToken: payload.replyToken,
      replyFn: payload.replyFn,
      eventSource: payload.eventSource,
      planInfo,
      explicitPaidIntent,
      paidIntent,
      routerMode,
      routerReason,
      normalizedConversationIntent,
      contextSnapshot,
      llmConciergeEnabled,
      llmWebSearchEnabled,
      llmStyleEngineEnabled,
      llmBanditEnabled,
      qualityEnabled,
      actionGatewayEnabled,
      snapshotStrictMode,
      maxNextActionsCap,
      recentEngagement,
      opportunityDecision,
      budgetPolicy: budget.policy || null,
      banditStateFetcher,
      traceId,
      requestId
    });
    if (orchestrated && orchestrated.handled === true) {
      return orchestrated;
    }
  }
  const greetingOrSmalltalkCasual = (
    opportunityDecision.conversationMode === 'casual'
    && opportunityDecision.opportunityType === 'none'
    && Array.isArray(opportunityDecision.opportunityReasonKeys)
    && opportunityDecision.opportunityReasonKeys.some((reason) => reason === 'greeting_detected' || reason === 'smalltalk_detected')
  );
  const routerAllowsOpportunityCasual = !conversationRouterEnabled || routerMode === 'problem' || routerMode === 'question';

  if (routerAllowsOpportunityCasual && (opportunityEngineEnabled || greetingOrSmalltalkCasual) && opportunityDecision.conversationMode === 'casual') {
    const casual = generatePaidCasualReply({
      messageText: text,
      contextHint: normalizedConversationIntent !== 'general' ? normalizedConversationIntent : '',
      followupIntent: null,
      recentResponseHints: [],
      suggestedAtoms: opportunityDecision.suggestedAtoms
    });
    const guardedReply = guardPaidMainReplyText(casual && casual.replyText ? casual.replyText : 'こんにちは。', {
      situationLine: casual && casual.replyText ? casual.replyText : 'こんにちは。',
      nextActions: [],
      pitfall: '',
      followupQuestion: '',
      defaultQuestion: '',
      preserveReplyText: true,
      disablePitfall: true,
      disableFollowup: true
    });
    const semanticReplyEnvelope = buildSemanticReplyEnvelope({
      replyText: guardedReply.replyText,
      domainIntent: normalizedConversationIntent,
      conversationMode: opportunityDecision.conversationMode || 'casual',
      eventSource: payload.eventSource,
      pathType: 'fast',
      uUnits: ['U-02', 'U-17', 'U-26', 'U-27'],
      nextSteps: [],
      followupQuestion: null
    });
    const replyText = normalizeReplyText(casual && casual.replyText ? casual.replyText : '') || guardedReply.replyText;
    await payload.replyFn(
      payload.replyToken,
      { type: 'text', text: replyText }
    );
    const assistantQuality = normalizeAssistantQuality(null, {
      intentResolved: paidIntent,
      kbTopScore: 0,
      evidenceCoverage: 0,
      blockedStage: null,
      fallbackReason: null
    });
    const usage = await recordLlmUsage({
      userId: lineUserId,
      plan: planInfo.plan,
      subscriptionStatus: planInfo.status,
      intent: paidIntent,
      decision: 'allow',
      blockedReason: null,
      tokensIn: 0,
      tokensOut: 0,
      tokenUsed: 0,
      model: budget.policy && budget.policy.model,
      assistantQuality
    });
    await appendLlmGateDecisionBestEffort({
      lineUserId,
      plan: planInfo.plan,
      status: planInfo.status,
      intent: paidIntent,
      decision: 'allow',
      blockedReason: null,
      tokenUsed: 0,
      costEstimate: usage && usage.costEstimate,
      model: budget.policy && budget.policy.model,
      policy: budget.policy || null,
      traceId,
      requestId,
      assistantQuality,
      conversationMode: opportunityDecision.conversationMode,
      routerReason,
      opportunityType: opportunityDecision.opportunityType,
      opportunityReasonKeys: opportunityDecision.opportunityReasonKeys,
      interventionBudget: opportunityDecision.interventionBudget,
      domainIntent: normalizedConversationIntent,
      conversationQuality,
      responseContractConformance: semanticReplyEnvelope.responseContractConformance
    });
    await appendLlmActionLogBestEffort({
      lineUserId,
      plan: planInfo.plan,
      traceId,
      requestId,
      replyText,
      llmBanditEnabled,
      conversationMode: opportunityDecision.conversationMode,
      routerReason,
      opportunityType: opportunityDecision.opportunityType,
      opportunityReasonKeys: opportunityDecision.opportunityReasonKeys,
      interventionBudget: opportunityDecision.interventionBudget,
      domainIntent: normalizedConversationIntent,
      conversationQuality,
      responseContractConformance: semanticReplyEnvelope.responseContractConformance
    });
    return {
      handled: true,
      mode: 'paid_casual',
      blockedReason: null
    };
  }

  if (isPaidDomainIntent) {
    const domainConcierge = await replyWithPaidDomainConcierge(Object.assign({}, payload, {
      blockedReason: null,
      contextSnapshot,
      domainIntent: normalizedConversationIntent
    }));
    const domainDecision = domainConcierge && domainConcierge.opportunityDecision
      ? domainConcierge.opportunityDecision
      : opportunityDecision;
    const assistantQuality = normalizeAssistantQuality(null, {
      intentResolved: paidIntent,
      kbTopScore: 0,
      evidenceCoverage: 0,
      blockedStage: null,
      fallbackReason: null
    });
    const usage = await recordLlmUsage({
      userId: lineUserId,
      plan: planInfo.plan,
      subscriptionStatus: planInfo.status,
      intent: paidIntent,
      decision: 'allow',
      blockedReason: null,
      tokensIn: 0,
      tokensOut: 0,
      tokenUsed: 0,
      model: budget.policy && budget.policy.model,
      assistantQuality
    });
    await appendLlmGateDecisionBestEffort({
      lineUserId,
      plan: planInfo.plan,
      status: planInfo.status,
      intent: paidIntent,
      decision: 'allow',
      blockedReason: null,
      tokenUsed: 0,
      costEstimate: usage && usage.costEstimate,
      model: budget.policy && budget.policy.model,
      policy: budget.policy || null,
      traceId,
      requestId,
      conciergeMeta: domainConcierge && domainConcierge.conciergeMeta ? domainConcierge.conciergeMeta : null,
      assistantQuality,
      conversationMode: 'concierge',
      routerReason,
      opportunityType: domainDecision.opportunityType,
      opportunityReasonKeys: domainDecision.opportunityReasonKeys,
      interventionBudget: 1,
      followupIntent: domainConcierge && typeof domainConcierge.followupIntent === 'string' ? domainConcierge.followupIntent : null,
      conciseModeApplied: domainConcierge ? domainConcierge.conciseModeApplied === true : false,
      repetitionPrevented: false,
      emergencyContext: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.emergencyContext === true
        : false,
      emergencySeverity: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.emergencySeverity || null
        : null,
      emergencyOfficialSourceSatisfied: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.emergencyOfficialSourceSatisfied === true
        : false,
      journeyContext: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.journeyContext === true
        : false,
      journeyPhase: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.journeyPhase || null
        : null,
      taskBlockerDetected: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.taskBlockerDetected === true
        : false,
      journeyAlignedAction: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.journeyAlignedAction !== false
        : true,
      cityPackContext: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.cityPackContext === true
        : false,
      cityPackGrounded: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.cityPackGrounded === true
        : false,
      cityPackFreshnessScore: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.cityPackFreshnessScore
        : null,
      cityPackAuthorityScore: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.cityPackAuthorityScore
        : null,
      crossSystemConflictDetected: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.crossSystemConflictDetected === true
        : false,
      domainIntent: normalizedConversationIntent,
      conversationQuality: domainConcierge && domainConcierge.conversationQuality
        ? domainConcierge.conversationQuality
        : buildConversationQualityMeta({
          replyText: domainConcierge && domainConcierge.replyText ? domainConcierge.replyText : '',
          domainIntent: normalizedConversationIntent,
          opportunityReasonKeys: domainDecision ? domainDecision.opportunityReasonKeys : [],
          fallbackType: null
        })
    });
    await appendLlmActionLogBestEffort({
      lineUserId,
      plan: planInfo.plan,
      traceId,
      requestId,
      replyText: domainConcierge && domainConcierge.replyText ? domainConcierge.replyText : '',
      conciergeMeta: domainConcierge && domainConcierge.conciergeMeta ? domainConcierge.conciergeMeta : null,
      llmBanditEnabled,
      conversationMode: 'concierge',
      routerReason,
      opportunityType: domainDecision.opportunityType,
      opportunityReasonKeys: domainDecision.opportunityReasonKeys,
      interventionBudget: 1,
      followupIntent: domainConcierge && typeof domainConcierge.followupIntent === 'string' ? domainConcierge.followupIntent : null,
      conciseModeApplied: domainConcierge ? domainConcierge.conciseModeApplied === true : false,
      repetitionPrevented: false,
      emergencyContext: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.emergencyContext === true
        : false,
      emergencySeverity: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.emergencySeverity || null
        : null,
      emergencyOfficialSourceSatisfied: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.emergencyOfficialSourceSatisfied === true
        : false,
      journeyContext: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.journeyContext === true
        : false,
      journeyPhase: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.journeyPhase || null
        : null,
      taskBlockerDetected: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.taskBlockerDetected === true
        : false,
      journeyAlignedAction: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.journeyAlignedAction !== false
        : true,
      cityPackContext: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.cityPackContext === true
        : false,
      cityPackGrounded: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.cityPackGrounded === true
        : false,
      cityPackFreshnessScore: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.cityPackFreshnessScore
        : null,
      cityPackAuthorityScore: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.cityPackAuthorityScore
        : null,
      crossSystemConflictDetected: domainConcierge && domainConcierge.integrationSignals
        ? domainConcierge.integrationSignals.crossSystemConflictDetected === true
        : false,
      domainIntent: normalizedConversationIntent,
      contextSnapshot,
      conversationQuality: domainConcierge && domainConcierge.conversationQuality
        ? domainConcierge.conversationQuality
        : buildConversationQualityMeta({
          replyText: domainConcierge && domainConcierge.replyText ? domainConcierge.replyText : '',
          domainIntent: normalizedConversationIntent,
          opportunityReasonKeys: domainDecision.opportunityReasonKeys,
          fallbackType: null
        })
    });
    return {
      handled: true,
      mode: 'paid_domain_concierge',
      blockedReason: null
    };
  }

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
      skipPersonalizedContext: snapshotStrictMode === true,
      forceConversationFormat: true
    })
    : await generatePaidAssistantReply({
      question: text,
      intent: paidIntent,
      locale: 'ja',
      llmAdapter: llmClient,
      llmPolicy: budget.policy,
      contextSnapshot,
      maxNextActionsCap,
      forceConversationFormat: true
    });

  if (!paid.ok) {
    const blockedReason = paid.blockedReason || 'llm_error';
    const assistantQuality = normalizeAssistantQuality(paid.assistantQuality, {
      intentResolved: paidIntent,
      kbTopScore: paid.top1Score || 0,
      evidenceCoverage: 0,
      blockedStage: 'paid_generation',
      fallbackReason: blockedReason
    });
    const shouldFallbackToConcierge = true;
    if (shouldFallbackToConcierge) {
      const fallback = await replyWithPaidDomainConcierge(Object.assign({}, payload, {
        blockedReason,
        contextSnapshot,
        domainIntent: isPaidDomainIntent ? normalizedConversationIntent : 'general',
        forceConcierge: true
      }));
      const fallbackDecision = fallback && fallback.opportunityDecision
        ? fallback.opportunityDecision
        : opportunityDecision;
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
        model: budget.policy && budget.policy.model,
        assistantQuality
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
        requestId,
        conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
        assistantQuality,
        conversationMode: 'concierge',
        routerReason: routerReason || 'paid_fallback_concierge',
        opportunityType: fallbackDecision.opportunityType,
        opportunityReasonKeys: fallbackDecision.opportunityReasonKeys,
        interventionBudget: 1,
        followupIntent: fallback && typeof fallback.followupIntent === 'string' ? fallback.followupIntent : null,
        conciseModeApplied: fallback ? fallback.conciseModeApplied === true : false,
        repetitionPrevented: false,
        domainIntent: normalizedConversationIntent,
        conversationQuality: fallback && fallback.conversationQuality ? fallback.conversationQuality : buildConversationQualityMeta({
          replyText: fallback && fallback.replyText ? fallback.replyText : '',
          domainIntent: normalizedConversationIntent,
          fallbackType: 'paid_generation_fallback',
          opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : []
        })
      });
      await appendLlmActionLogBestEffort({
        lineUserId,
        plan: planInfo.plan,
        traceId,
        requestId,
        replyText: fallback && fallback.replyText ? fallback.replyText : '',
        conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
        llmBanditEnabled,
        conversationMode: 'concierge',
        routerReason: routerReason || 'paid_fallback_concierge',
        opportunityType: fallbackDecision.opportunityType,
        opportunityReasonKeys: fallbackDecision.opportunityReasonKeys,
        interventionBudget: 1,
        followupIntent: fallback && typeof fallback.followupIntent === 'string' ? fallback.followupIntent : null,
        conciseModeApplied: fallback ? fallback.conciseModeApplied === true : false,
        repetitionPrevented: false,
        domainIntent: normalizedConversationIntent,
        contextSnapshot,
        conversationQuality: fallback && fallback.conversationQuality ? fallback.conversationQuality : buildConversationQualityMeta({
          replyText: fallback && fallback.replyText ? fallback.replyText : '',
          domainIntent: normalizedConversationIntent,
          fallbackType: 'paid_generation_fallback',
          opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : []
        })
      });
      return {
        handled: true,
        mode: 'fallback',
        fallback,
        blockedReason
      };
    }
  }

  const isLowRelevanceWarning = paid.qualityWarning === 'low_relevance_query';
  let replyText = stripLegacyTemplateTokensForPaid(trimForLineMessage(paid.replyText)) || '回答の整形に失敗しました。';
  if (isLowRelevanceWarning) {
    replyText = buildLowRelevanceConversationReply(text);
  }
  if (paid.qualityWarning === 'low_confidence_soft') {
    replyText = trimForLineMessage(`${replyText}\n\n補足: 根拠の一致度が低めのため、重要事項は運用担当へ最終確認してください。`);
  }
  if (resolveProPredictiveActionsEnabled() && isDependencyHintIntent(text) && !isLowRelevanceWarning) {
    const addendum = buildProDependencyAddendum(await loadTaskGraphSummary(lineUserId));
    if (addendum) replyText = trimForLineMessage(`${replyText}\n\n${addendum}`);
  }
  let conciergeMeta = null;
  const routerAllowsConciergeCompose = !conversationRouterEnabled || routerMode === 'problem' || routerMode === 'question';
  if (
    llmConciergeEnabled
    && !isLowRelevanceWarning
    && routerAllowsConciergeCompose
    && (!opportunityEngineEnabled || opportunityDecision.conversationMode === 'concierge')
  ) {
    try {
      const storedCandidates = await resolveStoredCandidatesForPaid(paid, {
        lineUserId,
        locale: 'ja',
        domainIntent: normalizedConversationIntent,
        intentRiskTier: riskSnapshot.intentRiskTier
      });
      const concierge = await composeConciergeReply({
        question: text,
        baseReplyText: replyText,
        legalSnapshot: payload.legalSnapshot || null,
        domainIntent: normalizedConversationIntent,
        intentRiskTier: resolveIntentRiskTier({
          domainIntent: normalizedConversationIntent
        }).intentRiskTier,
        opportunityHints: opportunityDecision && opportunityDecision.opportunityType !== 'none'
          ? {
            summary: paid && paid.output && typeof paid.output.situation === 'string'
              ? paid.output.situation
              : text,
            nextActions: opportunityDecision.suggestedAtoms && Array.isArray(opportunityDecision.suggestedAtoms.nextActions)
              ? opportunityDecision.suggestedAtoms.nextActions.slice(0, 3)
              : [],
            pitfall: opportunityDecision.suggestedAtoms && typeof opportunityDecision.suggestedAtoms.pitfall === 'string'
              ? opportunityDecision.suggestedAtoms.pitfall
              : '',
            question: opportunityDecision.suggestedAtoms && typeof opportunityDecision.suggestedAtoms.question === 'string'
              ? opportunityDecision.suggestedAtoms.question
              : ''
          }
          : null,
        userTier: 'paid',
        plan: planInfo.plan,
        locale: 'ja',
        contextSnapshot,
        storedCandidates,
        denylist: budget.policy && Array.isArray(budget.policy.forbidden_domains)
          ? budget.policy.forbidden_domains
          : [],
        webSearchEnabled: llmWebSearchEnabled,
        styleEngineEnabled: llmStyleEngineEnabled,
        bandit: {
          enabled: llmBanditEnabled,
          epsilon: 0.1,
          stateFetcher: banditStateFetcher
        },
        env: process.env
      });
      replyText = concierge && concierge.replyText ? concierge.replyText : replyText;
      conciergeMeta = concierge && concierge.auditMeta ? concierge.auditMeta : null;
    } catch (_err) {
      conciergeMeta = {
        topic: null,
        mode: null,
        userTier: 'paid',
        citationRanks: [],
        urlCount: 0,
        urls: [],
        guardDecisions: [],
        blockedReasons: ['concierge_compose_failed'],
        injectionFindings: false,
        evidenceNeed: 'none',
        evidenceOutcome: 'BLOCKED',
        chosenAction: null,
        contextVersion: 'concierge_ctx_v1',
        featureHash: null,
        postRenderLint: { findings: [], modified: false },
        contextSignature: null,
        contextualBanditEnabled: false,
        contextualFeatures: null,
        counterfactualSelectedArmId: null,
        counterfactualSelectedRank: null,
        counterfactualTopArms: [],
        counterfactualEval: null
      };
    }
  }
  const guardedMainReply = guardPaidMainReplyText(replyText, {
    fallbackText: '状況を整理しながら進めます。優先手続きを1つ決めて進めましょう。',
    nextActions: paid && paid.output && Array.isArray(paid.output.nextActions) ? paid.output.nextActions : [],
    pitfall: paid && paid.output && Array.isArray(paid.output.risks) ? paid.output.risks[0] : '',
    followupQuestion: paid && paid.output && Array.isArray(paid.output.gaps) ? paid.output.gaps[0] : ''
  });
  const assistantQuality = normalizeAssistantQuality(paid.assistantQuality, {
    intentResolved: paidIntent,
    kbTopScore: paid.top1Score || 0,
    evidenceCoverage: Array.isArray(paid && paid.output && paid.output.evidenceKeys) && paid.output.evidenceKeys.length > 0
      ? 1
      : 0,
    blockedStage: null,
    fallbackReason: null
  });
  const legalSnapshot = resolveLlmLegalPolicySnapshot({ policy: budget.policy || null });
  const riskSnapshot = resolveIntentRiskTier({ domainIntent: normalizedConversationIntent });
  const journeySignals = resolveJourneyActionSignals({
    contextSnapshot,
    journeyPhase: contextSnapshot && (contextSnapshot.phase || contextSnapshot.journeyPhase)
      ? String(contextSnapshot.phase || contextSnapshot.journeyPhase)
      : null,
    nextActions: paid && paid.output && Array.isArray(paid.output.nextActions) ? paid.output.nextActions : []
  });
  const [cityPackSignals, emergencySignals] = await Promise.all([
    resolveRuntimeCityPackSignals({
      lineUserId,
      locale: 'ja',
      domainIntent: normalizedConversationIntent,
      intentRiskTier: riskSnapshot.intentRiskTier
    }),
    resolveRuntimeEmergencySignals({
      lineUserId,
      contextSnapshot
    })
  ]);
  const readinessTelemetry = resolveAnswerReadinessTelemetry({
    legalSnapshot,
    riskSnapshot,
    sourceAuthorityScore: conciergeMeta && Number.isFinite(Number(conciergeMeta.sourceAuthorityScore))
      ? Number(conciergeMeta.sourceAuthorityScore)
      : null,
    sourceFreshnessScore: conciergeMeta && Number.isFinite(Number(conciergeMeta.sourceFreshnessScore))
      ? Number(conciergeMeta.sourceFreshnessScore)
      : null,
    sourceReadinessDecision: conciergeMeta && typeof conciergeMeta.sourceReadinessDecision === 'string'
      ? conciergeMeta.sourceReadinessDecision
      : null,
    sourceReadinessReasons: conciergeMeta && Array.isArray(conciergeMeta.sourceReadinessReasons)
      ? conciergeMeta.sourceReadinessReasons
      : [],
    officialOnlySatisfied: conciergeMeta ? conciergeMeta.officialOnlySatisfied === true : false,
    assistantQuality,
    fallbackType: null,
    contradictionFlags: [],
    unsupportedClaimCount: 0,
    contradictionDetected: false,
    emergencyContext: emergencySignals.emergencyContext === true,
    emergencySeverity: emergencySignals.emergencySeverity || null,
    emergencyOfficialSourceSatisfied: emergencySignals.emergencyOfficialSourceSatisfied === true,
    journeyContext: journeySignals.journeyContext === true,
    journeyPhase: journeySignals.journeyPhase || null,
    contextSnapshot,
    taskBlockerDetected: journeySignals.taskBlockerDetected === true,
    journeyAlignedAction: journeySignals.journeyAlignedAction !== false,
    cityPackContext: cityPackSignals.cityPackContext === true,
    cityPackGrounded: cityPackSignals.cityPackGrounded === true,
    cityPackFreshnessScore: cityPackSignals.cityPackFreshnessScore,
    cityPackAuthorityScore: cityPackSignals.cityPackAuthorityScore,
    cityPackValidation: cityPackSignals.cityPackValidation,
    crossSystemConflictDetected: false
  });
  const readinessApplied = applyAnswerReadinessDecision({
    decision: readinessTelemetry.readiness.decision,
    replyText: guardedMainReply.replyText,
    clarifyText: 'まず対象手続きと期限を1つずつ教えてください。そこから具体的な次の一手を整理します。',
    refuseText: 'この内容は安全に断定できないため、公式窓口で最終確認をお願いします。必要なら確認項目を整理します。'
  });
  const semanticReplyEnvelope = buildSemanticReplyEnvelope({
    replyText: readinessApplied.replyText,
    domainIntent: normalizedConversationIntent,
    conversationMode: (opportunityEngineEnabled || greetingOrSmalltalkCasual || runRouterOpportunityPath)
      ? opportunityDecision.conversationMode
      : (conversationRouterEnabled
        ? (routerMode === 'problem' && llmConciergeEnabled ? 'concierge' : 'casual')
        : (llmConciergeEnabled && !isLowRelevanceWarning ? 'concierge' : null)),
    eventSource: payload.eventSource,
    pathType: 'slow',
    uUnits: ['U-05', 'U-06', 'U-09', 'U-11', 'U-12', 'U-13', 'U-14', 'U-15', 'U-16', 'U-17'],
    nextSteps: paid && paid.output && Array.isArray(paid.output.nextActions) ? paid.output.nextActions : [],
    followupQuestion: paid && paid.output && Array.isArray(paid.output.gaps) ? paid.output.gaps[0] : '',
    warnings: []
      .concat(conciergeMeta && Array.isArray(conciergeMeta.blockedReasons) ? conciergeMeta.blockedReasons : [])
      .concat(readinessTelemetry.readiness && Array.isArray(readinessTelemetry.readiness.reasonCodes)
        ? readinessTelemetry.readiness.reasonCodes
        : []),
    legalSnapshot,
    sourceAuthorityScore: conciergeMeta && Number.isFinite(Number(conciergeMeta.sourceAuthorityScore))
      ? Number(conciergeMeta.sourceAuthorityScore)
      : null,
    sourceFreshnessScore: conciergeMeta && Number.isFinite(Number(conciergeMeta.sourceFreshnessScore))
      ? Number(conciergeMeta.sourceFreshnessScore)
      : null,
    sourceReadinessDecision: conciergeMeta && typeof conciergeMeta.sourceReadinessDecision === 'string'
      ? conciergeMeta.sourceReadinessDecision
      : null,
    officialOnlySatisfied: conciergeMeta ? conciergeMeta.officialOnlySatisfied === true : false,
    readinessDecision: readinessTelemetry.readiness ? readinessTelemetry.readiness.decision : null,
    readinessReasonCodes: readinessTelemetry.readiness && Array.isArray(readinessTelemetry.readiness.reasonCodes)
      ? readinessTelemetry.readiness.reasonCodes
      : [],
    regulatedLane: riskSnapshot && riskSnapshot.intentRiskTier === 'regulated',
    highUncertainty: readinessTelemetry.readiness
      ? readinessTelemetry.readiness.decision !== 'allow'
      : false,
    escalationRequired: readinessTelemetry.readiness
      ? readinessTelemetry.readiness.decision === 'refuse'
      : false
  });
  replyText = semanticReplyEnvelope.replyText;
  await payload.replyFn(
    payload.replyToken,
    semanticReplyEnvelope.lineMessage || { type: 'text', text: replyText }
  );
  const tokenUsed = (paid.tokensIn || 0) + (paid.tokensOut || 0);
  const conversationMode = (opportunityEngineEnabled || greetingOrSmalltalkCasual || runRouterOpportunityPath)
    ? opportunityDecision.conversationMode
    : (conversationRouterEnabled
      ? (routerMode === 'problem' && llmConciergeEnabled ? 'concierge' : 'casual')
      : (llmConciergeEnabled && !isLowRelevanceWarning ? 'concierge' : null));
  const opportunityType = (opportunityEngineEnabled || greetingOrSmalltalkCasual || runRouterOpportunityPath) ? opportunityDecision.opportunityType : 'none';
  const opportunityReasonKeys = (opportunityEngineEnabled || greetingOrSmalltalkCasual || runRouterOpportunityPath) ? opportunityDecision.opportunityReasonKeys : [];
  const interventionBudget = (opportunityEngineEnabled || greetingOrSmalltalkCasual || runRouterOpportunityPath) ? opportunityDecision.interventionBudget : 0;
  const conversationQuality = buildConversationQualityMeta({
    replyText,
    domainIntent: normalizedConversationIntent,
    nextActions: paid && paid.output && Array.isArray(paid.output.nextActions) ? paid.output.nextActions : [],
    opportunityReasonKeys,
    fallbackType: null,
    legacyTemplateHit: guardedMainReply.legacyTemplateHit === true,
    pitfallIncluded: guardedMainReply.pitfallIncluded === true,
    followupQuestionIncluded: guardedMainReply.followupQuestionIncluded === true
  });
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
    model: paid.model || (budget.policy && budget.policy.model),
    assistantQuality
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
    requestId,
    conciergeMeta,
    assistantQuality,
    conversationMode,
    routerReason,
    opportunityType,
    opportunityReasonKeys,
    interventionBudget,
    domainIntent: normalizedConversationIntent,
    conversationQuality,
    sourceAuthorityScore: readinessTelemetry.readiness.qualitySnapshot.sourceAuthorityScore,
    sourceFreshnessScore: readinessTelemetry.readiness.qualitySnapshot.sourceFreshnessScore,
    sourceReadinessDecision: readinessTelemetry.readiness.qualitySnapshot.sourceReadinessDecision,
    sourceReadinessReasons: conciergeMeta && Array.isArray(conciergeMeta.sourceReadinessReasons)
      ? conciergeMeta.sourceReadinessReasons
      : [],
    officialOnlySatisfied: readinessTelemetry.readiness.qualitySnapshot.officialOnlySatisfied === true,
    readinessDecision: readinessTelemetry.readiness.decision,
    readinessReasonCodes: readinessTelemetry.readiness.reasonCodes,
    readinessSafeResponseMode: readinessTelemetry.readiness.safeResponseMode,
    unsupportedClaimCount: readinessTelemetry.unsupportedClaimCount,
    contradictionDetected: readinessTelemetry.contradictionDetected,
    answerReadinessLogOnly: false,
    answerReadinessLogOnlyV2: readinessTelemetry.answerReadinessLogOnlyV2 === true,
    answerReadinessEnforcedV2: readinessTelemetry.answerReadinessEnforcedV2 === true,
    answerReadinessV2Mode: readinessTelemetry.answerReadinessV2Mode || null,
    answerReadinessV2Stage: readinessTelemetry.answerReadinessV2Stage || null,
    answerReadinessV2EnforcementReason: readinessTelemetry.answerReadinessV2EnforcementReason || null,
    legalSnapshot,
    responseContractConformance: semanticReplyEnvelope.responseContractConformance
  });
  await appendLlmActionLogBestEffort({
    lineUserId,
    plan: planInfo.plan,
    traceId,
    requestId,
    replyText,
    conciergeMeta,
    llmBanditEnabled,
    conversationMode,
    routerReason,
    opportunityType,
    opportunityReasonKeys,
    interventionBudget,
    domainIntent: normalizedConversationIntent,
    conversationQuality,
    sourceAuthorityScore: readinessTelemetry.readiness.qualitySnapshot.sourceAuthorityScore,
    sourceFreshnessScore: readinessTelemetry.readiness.qualitySnapshot.sourceFreshnessScore,
    sourceReadinessDecision: readinessTelemetry.readiness.qualitySnapshot.sourceReadinessDecision,
    sourceReadinessReasons: conciergeMeta && Array.isArray(conciergeMeta.sourceReadinessReasons)
      ? conciergeMeta.sourceReadinessReasons
      : [],
    officialOnlySatisfied: readinessTelemetry.readiness.qualitySnapshot.officialOnlySatisfied === true,
    readinessDecision: readinessTelemetry.readiness.decision,
    readinessReasonCodes: readinessTelemetry.readiness.reasonCodes,
    readinessSafeResponseMode: readinessTelemetry.readiness.safeResponseMode,
    unsupportedClaimCount: readinessTelemetry.unsupportedClaimCount,
    contradictionDetected: readinessTelemetry.contradictionDetected,
    answerReadinessLogOnly: false,
    answerReadinessLogOnlyV2: readinessTelemetry.answerReadinessLogOnlyV2 === true,
    answerReadinessEnforcedV2: readinessTelemetry.answerReadinessEnforcedV2 === true,
    answerReadinessV2Mode: readinessTelemetry.answerReadinessV2Mode || null,
    answerReadinessV2Stage: readinessTelemetry.answerReadinessV2Stage || null,
    answerReadinessV2EnforcementReason: readinessTelemetry.answerReadinessV2EnforcementReason || null,
    legalSnapshot,
    contextSnapshot,
    responseContractConformance: semanticReplyEnvelope.responseContractConformance
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
  const trustedPayload = options && options.trustedPayload && typeof options.trustedPayload === 'object'
    ? options.trustedPayload
    : null;
  const trustedPayloadMode = trustedPayload !== null;
  const logger = (options && options.logger) || (() => {});
  const optionRequestId = options && typeof options.requestId === 'string' ? options.requestId.trim() : '';
  const optionTraceId = options && typeof options.traceId === 'string' ? options.traceId.trim() : '';
  const requestId = optionRequestId || `line_webhook_${crypto.randomUUID()}`;
  const traceId = optionTraceId || requestId;
  const isWebhookEdge = process.env.SERVICE_MODE === 'webhook';
  const allowWelcome = Boolean(options && options.allowWelcome === true);

  if (!trustedPayloadMode && !secret) {
    logger(`[webhook] requestId=${requestId} reject=missing-secret`);
    return {
      status: 500,
      body: 'server misconfigured',
      outcome: buildOutcome({ ok: false }, {
        state: 'error',
        reason: 'missing_secret',
        routeType: 'webhook',
        guard: { routeKey: ROUTE_KEY, decision: 'block' }
      })
    };
  }
  if (!trustedPayloadMode && (typeof signature !== 'string' || signature.length === 0)) {
    logger(`[webhook] requestId=${requestId} reject=missing-signature`);
    return {
      status: 401,
      body: 'unauthorized',
      outcome: buildOutcome({ ok: false }, {
        state: 'blocked',
        reason: 'missing_signature',
        routeType: 'webhook',
        guard: { routeKey: ROUTE_KEY, decision: 'block' }
      })
    };
  }
  if (!trustedPayloadMode && !verifyLineSignature(secret, body, signature)) {
    logger(`[webhook] requestId=${requestId} reject=invalid-signature`);
    return {
      status: 401,
      body: 'unauthorized',
      outcome: buildOutcome({ ok: false }, {
        state: 'blocked',
        reason: 'invalid_signature',
        routeType: 'webhook',
        guard: { routeKey: ROUTE_KEY, decision: 'block' }
      })
    };
  }

  let payload;
  if (trustedPayloadMode) {
    payload = trustedPayload;
  } else {
    try {
      payload = JSON.parse(body || '{}');
    } catch (err) {
      logger(`[webhook] requestId=${requestId} reject=invalid-json`);
      return {
        status: 400,
        body: 'invalid json',
        outcome: buildOutcome({ ok: false }, {
          state: 'error',
          reason: 'invalid_json',
          routeType: 'webhook',
          guard: { routeKey: ROUTE_KEY, decision: 'block' }
        })
      };
    }
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
        failCloseMode: DEFAULT_PUBLIC_WRITE_FAIL_CLOSE_MODE,
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
      return {
        status: 503,
        body: 'temporarily unavailable',
        outcome: buildOutcome({ ok: false }, {
          state: 'blocked',
          reason: 'kill_switch_read_failed_fail_closed',
          routeType: 'webhook',
          guard: {
            routeKey: ROUTE_KEY,
            failCloseMode: safety.failCloseMode || null,
            readError: true,
            decision: 'block'
          }
        })
      };
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
    return {
      status: 409,
      body: 'kill switch on',
      outcome: buildOutcome({ ok: false }, {
        state: 'blocked',
        reason: 'kill_switch_on',
        routeType: 'webhook',
        guard: {
          routeKey: ROUTE_KEY,
          failCloseMode: safety.failCloseMode || null,
          killSwitchOn: true,
          decision: 'block'
        }
      })
    };
  }

  await logLineWebhookEventsBestEffort({ payload, requestId });
  const [llmConciergeEnabled, llmWebSearchEnabled, llmStyleEngineEnabled, llmBanditEnabled] = await Promise.all([
    resolveLlmConciergeEnabledBestEffort(),
    resolveLlmWebSearchEnabledBestEffort(),
    resolveLlmStyleEngineEnabledBestEffort(),
    resolveLlmBanditEnabledBestEffort()
  ]);

  const channelEdgeEnabled = resolveV1ChannelEdgeEnabled();
  const fastSlowDispatchEnabled = resolveV1FastSlowDispatchEnabled();

  const userIds = extractUserIds(payload);
  const firstUserId = userIds[0] || '';
  const welcomeFn = (options && options.sendWelcomeFn) || sendWelcomeMessage;
  const replyFn = (options && options.replyFn) || replyMessage;
  const pushFn = (options && options.pushFn) || pushMessage || (async () => ({ status: 200 }));

  // Ensure users and run interactive commands (best-effort).
  const rawEvents = Array.isArray(payload && payload.events) ? payload.events : [];
  const filteredEvents = channelEdgeEnabled
    ? await filterWebhookEventsAsync(rawEvents, {
      dedupeStore: WEBHOOK_EDGE_STATE_STORE,
      orderingStore: WEBHOOK_EDGE_STATE_STORE,
      skewToleranceMs: 20000
    })
    : { accepted: rawEvents, dropped: [] };
  const events = Array.isArray(filteredEvents.accepted) ? filteredEvents.accepted : [];
  if (channelEdgeEnabled && Array.isArray(filteredEvents.dropped) && filteredEvents.dropped.length > 0) {
    await appendAuditLog({
      actor: 'system',
      action: 'line_webhook.events.filtered',
      entityType: 'line_webhook',
      entityId: requestId,
      traceId,
      requestId,
      payloadSummary: {
        droppedCount: filteredEvents.dropped.length,
        reasons: Array.from(new Set(filteredEvents.dropped.map((row) => row && row.reason).filter(Boolean))).slice(0, 5)
      }
    }).catch(() => null);
    logger(`[webhook] requestId=${requestId} events_filtered dropped=${filteredEvents.dropped.length}`);
  }
  const ensured = new Set();
  for (const event of events) {
    const userId = extractLineUserId(event);
    if (!userId) continue;
    if (!ensured.has(userId)) {
      await ensureUserFromWebhook(userId);
      ensured.add(userId);
      if (!isWebhookEdge || allowWelcome) {
        await welcomeFn({ lineUserId: userId, pushFn });
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
            data: postbackData,
            traceId,
            requestId,
            actor: userId
          });
          if (await sendJourneyResponse({
            journey,
            replyToken,
            lineUserId: userId,
            replyFn,
            pushFn,
            traceId,
            requestId
          })) {
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
      const isSyntheticMessage = event && event._synthetic === true;
      const canSyntheticReply = isSyntheticMessage && Boolean(userId);
      const syntheticReplyToken = canSyntheticReply
        ? `synthetic_${typeof event.webhookEventId === 'string' && event.webhookEventId ? event.webhookEventId : requestId}`
        : null;
      const effectiveReplyToken = replyToken || syntheticReplyToken;
      const effectiveReplyFn = replyToken
        ? replyFn
        : (canSyntheticReply
          ? async (_replyToken, message) => pushFn(userId, message)
          : null);
      if (text && effectiveReplyToken && typeof effectiveReplyFn === 'function') {
        try {
          if (isSyntheticMessage) {
            const assistant = await handleAssistantMessage({
              lineUserId: userId,
              text,
              replyToken: effectiveReplyToken,
              replyFn: effectiveReplyFn,
              eventSource: event.source,
              requestId,
              llmConciergeEnabled,
              llmWebSearchEnabled,
              llmStyleEngineEnabled,
              llmBanditEnabled
            });
            if (assistant && assistant.handled) {
              const mode = assistant.mode || 'unknown';
              const blockedReason = assistant.blockedReason || '-';
              logger(`[webhook] requestId=${requestId} synthetic_assistant mode=${mode} blockedReason=${blockedReason} lineUserId=${userId}`);
              continue;
            }
            await effectiveReplyFn(effectiveReplyToken, {
              type: 'text',
              text: '受け取りました。続けて状況を一緒に整理します。'
            });
            continue;
          }

          if (fastSlowDispatchEnabled) {
            const dispatch = classifyDispatchMode(event);
            await appendAuditLog({
              actor: userId,
              action: 'line_webhook.dispatch.classified',
              entityType: 'line_webhook',
              entityId: requestId,
              traceId,
              requestId,
              payloadSummary: {
                mode: dispatch.mode,
                reason: dispatch.reason
              }
            }).catch(() => null);
            if (dispatch.mode === 'slow' && resolveBooleanEnvFlag('ENABLE_V1_FAST_SLOW_ACK', false)) {
              await replyFn(replyToken, buildServiceAckMessage());
            }
          }

          const journey = await handleJourneyLineCommand({
            lineUserId: userId,
            text,
            traceId,
            requestId,
            actor: userId
          });
          if (await sendJourneyResponse({
            journey,
            replyToken,
            lineUserId: userId,
            replyFn,
            pushFn,
            traceId,
            requestId
          })) {
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
            await syncCityPackRecommendedTasks({
              lineUserId: userId,
              regionKey: region.regionKey,
              actor: 'webhook_line_region_declared',
              traceId: requestId,
              requestId
            }).catch(() => null);
            await replyFn(replyToken, { type: 'text', text: regionDeclared(region.regionCity, region.regionState) });
            continue;
          }
          if (region.status === 'prompt_required') {
            const message = region.reason === 'invalid_format' ? regionInvalid() : regionPrompt();
            await replyFn(replyToken, { type: 'text', text: message });
            continue;
          }
          if (region.status === 'already_set') {
            if (shouldReplyWithRegionAlreadySet(text)) {
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
            eventSource: event.source,
            requestId,
            llmConciergeEnabled,
            llmWebSearchEnabled,
            llmStyleEngineEnabled,
            llmBanditEnabled
          });
          if (assistant && assistant.handled) {
            const mode = assistant.mode || 'unknown';
            const blockedReason = assistant.blockedReason || '-';
            logger(`[webhook] requestId=${requestId} llm_assistant mode=${mode} blockedReason=${blockedReason} lineUserId=${userId}`);
            continue;
          }
        } catch (err) {
          const msg = err && err.message ? err.message : 'error';
          const errorClass = err && err.name ? String(err.name) : 'Error';
          logger(`[webhook] requestId=${requestId} event_handler=error errorClass=${errorClass} message=${msg}`);
        }
      }
    }
  }

  logger(`[webhook] requestId=${requestId} accept`);
  return {
    status: 200,
    body: 'ok',
    userCount: userIds.length,
    firstUserId,
    outcome: buildOutcome({ ok: true }, {
      state: safety && safety.readError === true && safety.failCloseMode === 'warn' ? 'degraded' : 'success',
      reason: safety && safety.readError === true && safety.failCloseMode === 'warn'
        ? 'kill_switch_read_failed_fail_open'
        : 'ok',
      routeType: 'webhook',
      guard: {
        routeKey: ROUTE_KEY,
        failCloseMode: safety && safety.failCloseMode ? safety.failCloseMode : null,
        readError: Boolean(safety && safety.readError === true),
        killSwitchOn: false,
        decision: safety && safety.readError === true && safety.failCloseMode === 'warn' ? 'warn' : 'allow'
      }
    })
  };
}

module.exports = {
  handleLineWebhook,
  verifyLineSignature,
  extractUserIds,
  resolveTranscriptSnapshotAssistantReplyText,
  __testOnly: {
    buildSemanticReplyEnvelope
  }
};
