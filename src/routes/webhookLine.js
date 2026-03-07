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
const { generatePaidDomainConciergeReply, FORBIDDEN_REPLY_PATTERN } = require('../usecases/assistant/generatePaidDomainConciergeReply');
const { generatePaidHousingConciergeReply } = require('../usecases/assistant/generatePaidHousingConciergeReply');
const { runPaidConversationOrchestrator } = require('../domain/llm/orchestrator/runPaidConversationOrchestrator');
const { createEvent } = require('../repos/firestore/eventsRepo');
const { appendAuditLog } = require('../usecases/audit/appendAuditLog');
const { appendLlmGateDecision } = require('../usecases/llm/appendLlmGateDecision');
const {
  getPublicWriteSafetySnapshot,
  getLlmConciergeEnabled,
  getLlmWebSearchEnabled,
  getLlmStyleEngineEnabled,
  getLlmBanditEnabled
} = require('../repos/firestore/systemFlagsRepo');
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
const PAID_CONCIERGE_DOMAIN_INTENTS = new Set(['housing', 'school', 'ssn', 'banking']);

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
      : detectFollowupQuestionIncluded(guardedText)
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
  return resolveBooleanEnvFlag('ENABLE_PAID_ORCHESTRATOR_V2', false);
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
  const domainReply = domainIntent === 'housing'
    ? generatePaidHousingConciergeReply({
      lineUserId,
      messageText: text,
      contextSnapshot,
      opportunityDecision,
      blockedReason: payload.blockedReason || null
    })
    : generatePaidDomainConciergeReply({
      lineUserId,
      messageText: text,
      domainIntent,
      contextSnapshot,
      opportunityDecision,
      blockedReason: payload.blockedReason || null
    });
  const fallbackReplyText = '状況を整理しながら進めましょう。まずは優先する手続きを3つ以内に絞るのがおすすめです。';
  const rawReplyText = domainReply && domainReply.replyText ? domainReply.replyText : fallbackReplyText;
  const guardedReply = guardPaidMainReplyText(rawReplyText, {
    fallbackText: fallbackReplyText,
    nextActions: opportunityDecision && opportunityDecision.suggestedAtoms && Array.isArray(opportunityDecision.suggestedAtoms.nextActions)
      ? opportunityDecision.suggestedAtoms.nextActions
      : [],
    pitfall: opportunityDecision && opportunityDecision.suggestedAtoms
      ? opportunityDecision.suggestedAtoms.pitfall
      : '',
    followupQuestion: opportunityDecision && opportunityDecision.suggestedAtoms
      ? opportunityDecision.suggestedAtoms.question
      : ''
  });
  const replyText = guardedReply.replyText;
  const conversationQuality = buildConversationQualityMeta({
    replyText,
    domainIntent,
    nextActions: opportunityDecision && opportunityDecision.suggestedAtoms
      ? opportunityDecision.suggestedAtoms.nextActions
      : [],
    opportunityReasonKeys: opportunityDecision ? opportunityDecision.opportunityReasonKeys : [],
    fallbackType: payload.blockedReason ? 'domain_concierge_fallback' : 'domain_concierge',
    legacyTemplateHit: guardedReply.legacyTemplateHit === true,
    pitfallIncluded: guardedReply.pitfallIncluded === true,
    followupQuestionIncluded: guardedReply.followupQuestionIncluded === true,
    conversationNaturalnessVersion: payload.conversationNaturalnessVersion || 'v2'
  });
  return {
    ok: true,
    replyText,
    contextSnapshot,
    opportunityDecision,
    conciergeMeta: domainReply && domainReply.auditMeta ? domainReply.auditMeta : null,
    conversationQuality
  };
}

async function replyWithPaidDomainConcierge(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const result = await buildPaidDomainConciergeResult(payload);
  await payload.replyFn(payload.replyToken, { type: 'text', text: result.replyText });
  return result;
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

async function resolveStoredCandidatesForPaid(paid) {
  const evidenceKeys = uniqueStringList([]
    .concat(Array.isArray(paid && paid.citations) ? paid.citations : [])
    .concat(Array.isArray(paid && paid.output && paid.output.evidenceKeys) ? paid.output.evidenceKeys : []));
  if (!evidenceKeys.length) return [];
  const articleRows = await Promise.all(evidenceKeys.slice(0, 8).map(async (articleId) => {
    try {
      return await faqArticlesRepo.getArticle(articleId);
    } catch (_err) {
      return null;
    }
  }));
  const sourceIds = articleRows
    .filter(Boolean)
    .flatMap((row) => (Array.isArray(row.linkRegistryIds) ? row.linkRegistryIds : []));
  return resolveLinkRegistryCandidatesFromSourceIds(sourceIds, 'faq_link_registry');
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
  return {
    conversationNaturalnessVersion,
    legacyTemplateHit,
    followupQuestionIncluded,
    actionCount,
    pitfallIncluded,
    domainIntent,
    fallbackType,
    interventionSuppressedBy: resolveInterventionSuppressedBy(payload.opportunityReasonKeys)
  };
}

async function appendLlmGateDecisionBestEffort(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const lineUserId = typeof payload.lineUserId === 'string' ? payload.lineUserId.trim() : '';
  if (!lineUserId) return;
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
        conversationMode: typeof payload.conversationMode === 'string' && payload.conversationMode.trim()
          ? payload.conversationMode.trim().toLowerCase()
          : null,
        routerReason: typeof payload.routerReason === 'string' && payload.routerReason.trim()
          ? payload.routerReason.trim().toLowerCase().replace(/\s+/g, '_')
          : null,
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

  try {
    await llmActionLogsRepo.appendLlmActionLog({
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
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
      conversationMode: typeof payload.conversationMode === 'string'
        ? payload.conversationMode
        : (conciergeMeta && conciergeMeta.conversationState ? 'concierge' : null),
      routerReason: typeof payload.routerReason === 'string' && payload.routerReason.trim()
        ? payload.routerReason.trim().toLowerCase().replace(/\s+/g, '_')
        : null,
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
      fallbackType: qualityMeta.fallbackType || null,
      interventionSuppressedBy: qualityMeta.interventionSuppressedBy || null,
      strategy: typeof payload.strategy === 'string' ? payload.strategy : null,
      retrieveNeeded: payload.retrieveNeeded === true,
      retrievalQuality: typeof payload.retrievalQuality === 'string' ? payload.retrievalQuality : null,
      judgeWinner: typeof payload.judgeWinner === 'string' ? payload.judgeWinner : null,
      judgeScores: Array.isArray(payload.judgeScores) ? payload.judgeScores : [],
      verificationOutcome: typeof payload.verificationOutcome === 'string' ? payload.verificationOutcome : null,
      contradictionFlags: Array.isArray(payload.contradictionFlags) ? payload.contradictionFlags : [],
      candidateCount: Number.isFinite(Number(payload.candidateCount)) ? Number(payload.candidateCount) : 0,
      humanReviewLabel: typeof payload.humanReviewLabel === 'string' ? payload.humanReviewLabel : null,
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
  try {
    return await llmActionLogsRepo.listLlmActionLogsByLineUserId({
      lineUserId: normalizedUserId,
      limit
    });
  } catch (_err) {
    return [];
  }
}

async function tryHandlePaidOrchestratorV2(params) {
  const payload = params && typeof params === 'object' ? params : {};
  if (resolvePaidOrchestratorEnabled() !== true) return null;
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
    recentEngagement: payload.recentEngagement,
    blockedReason: options && Object.prototype.hasOwnProperty.call(options, 'blockedReason') ? options.blockedReason : null,
    forceConcierge: true,
    conversationNaturalnessVersion: 'v2'
  });
  const composeCandidateFactory = async ({ groundedResult, packet }) => {
    if (!groundedResult || groundedResult.ok !== true || payload.llmConciergeEnabled !== true) return null;
    const storedCandidates = await resolveStoredCandidatesForPaid(groundedResult);
    return composeConciergeReply({
      question: packet.messageText,
      baseReplyText: groundedResult.replyText,
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
      snapshotStrictMode: payload.snapshotStrictMode
    },
    maxNextActionsCap: payload.maxNextActionsCap,
    recentEngagement: payload.recentEngagement,
    opportunityDecision: payload.opportunityDecision,
    recentActionRows,
    deps: {
      generatePaidCasualReply,
      generateGroundedReply: groundedReplyFactory,
      generateDomainConciergeCandidate: domainCandidateFactory,
      composeConciergeCandidate: composeCandidateFactory
    }
  });

  if (!orchestrated || orchestrated.ok !== true) return null;

  await payload.replyFn(payload.replyToken, { type: 'text', text: orchestrated.replyText });
  const conversationQuality = buildConversationQualityMeta({
    replyText: orchestrated.replyText,
    domainIntent: orchestrated.domainIntent,
    nextActions: orchestrated.finalMeta && Array.isArray(orchestrated.finalMeta.committedNextActions)
      ? orchestrated.finalMeta.committedNextActions
      : [],
    opportunityReasonKeys: orchestrated.opportunityDecision ? orchestrated.opportunityDecision.opportunityReasonKeys : [],
    fallbackType: orchestrated.strategyPlan && orchestrated.strategyPlan.fallbackType ? orchestrated.strategyPlan.fallbackType : null,
    legacyTemplateHit: orchestrated.finalMeta && orchestrated.finalMeta.legacyTemplateHit === true,
    pitfallIncluded: orchestrated.finalMeta && orchestrated.finalMeta.pitfallIncluded === true,
    followupQuestionIncluded: orchestrated.finalMeta && orchestrated.finalMeta.followupQuestionIncluded === true,
    conversationNaturalnessVersion: 'v2'
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
    conversationQuality
  });
  await appendLlmActionLogBestEffort({
    lineUserId: payload.lineUserId,
    plan: payload.planInfo.plan,
    traceId: payload.traceId,
    requestId: payload.requestId,
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
    candidateCount: orchestrated.telemetry ? orchestrated.telemetry.candidateCount : 0,
    committedNextActions: orchestrated.telemetry ? orchestrated.telemetry.committedNextActions : [],
    committedFollowupQuestion: orchestrated.telemetry ? orchestrated.telemetry.committedFollowupQuestion : null,
    recentUserGoal: Array.isArray(orchestrated.packet && orchestrated.packet.recentUserGoals)
      ? (orchestrated.packet.recentUserGoals[0] || null)
      : null
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
    summary: orchestrated.replyText.split('\n')[0] || null,
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

  await payload.replyFn(payload.replyToken, { type: 'text', text: replyText });
  const conversationQuality = buildConversationQualityMeta({
    replyText,
    domainIntent,
    fallbackType: sanitizeLegacyTemplateForPaid ? 'free_retrieval_sanitized' : 'free_retrieval',
    opportunityReasonKeys: []
  });
  return Object.assign({}, retrieval, {
    replyText,
    conciergeMeta,
    conversationQuality
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
    const fallback = await replyWithFreeRetrieval(Object.assign({}, payload, {
      extraText: dependencyHint,
      blockedReason,
      plan: planInfo.plan,
      llmConciergeEnabled,
      llmWebSearchEnabled,
      llmStyleEngineEnabled,
      llmBanditEnabled
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
      assistantQuality
    });
    await appendLlmActionLogBestEffort({
      lineUserId,
      plan: planInfo.plan,
      traceId,
      requestId,
      conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
      llmBanditEnabled
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
  const shouldRouteToPaidCasual = conversationRouterEnabled && (routerMode === 'greeting' || routerMode === 'casual');

  if (shouldRouteToPaidCasual) {
    const casual = generatePaidCasualReply({
      messageText: text,
      suggestedAtoms: { nextActions: [], pitfall: null, question: null }
    });
    const guardedReply = guardPaidMainReplyText(casual && casual.replyText ? casual.replyText : 'こんにちは。', {
      situationLine: casual && casual.replyText ? casual.replyText : 'こんにちは。',
      nextActions: [],
      pitfall: '',
      followupQuestion: '',
      defaultQuestion: '',
      disablePitfall: true,
      disableFollowup: true
    });
    const replyText = guardedReply.replyText;
    await payload.replyFn(payload.replyToken, { type: 'text', text: replyText });
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
      conversationQuality
    });
    await appendLlmActionLogBestEffort({
      lineUserId,
      plan: planInfo.plan,
      traceId,
      requestId,
      llmBanditEnabled,
      conversationMode: 'casual',
      routerReason: routerReason || 'router_casual',
      opportunityType: 'none',
      opportunityReasonKeys: routerReason ? [routerReason] : [],
      interventionBudget: 0
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
      interventionBudget: 1
    });
    await appendLlmActionLogBestEffort({
      lineUserId,
      plan: planInfo.plan,
      traceId,
      requestId,
      conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
      llmBanditEnabled,
      conversationMode: 'concierge',
      routerReason: routerReason || 'paid_fallback_concierge',
      opportunityType: fallbackDecision ? fallbackDecision.opportunityType : 'none',
      opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : [],
      interventionBudget: 1,
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
      interventionBudget: 1
    });
    await appendLlmActionLogBestEffort({
      lineUserId,
      plan: planInfo.plan,
      traceId,
      requestId,
      conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
      llmBanditEnabled,
      conversationMode: 'concierge',
      routerReason: routerReason || 'paid_fallback_concierge',
      opportunityType: fallbackDecision ? fallbackDecision.opportunityType : 'none',
      opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : [],
      interventionBudget: 1,
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
      interventionBudget: 1
    });
    await appendLlmActionLogBestEffort({
      lineUserId,
      plan: planInfo.plan,
      traceId,
      requestId,
      conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
      llmBanditEnabled,
      conversationMode: 'concierge',
      routerReason: routerReason || 'paid_fallback_concierge',
      opportunityType: fallbackDecision ? fallbackDecision.opportunityType : 'none',
      opportunityReasonKeys: fallbackDecision ? fallbackDecision.opportunityReasonKeys : [],
      interventionBudget: 1,
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
  const orchestrated = await tryHandlePaidOrchestratorV2({
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
    contextSnapshot,
    llmConciergeEnabled,
    llmWebSearchEnabled,
    llmStyleEngineEnabled,
    llmBanditEnabled,
    qualityEnabled,
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
      suggestedAtoms: opportunityDecision.suggestedAtoms
    });
    const guardedReply = guardPaidMainReplyText(casual && casual.replyText ? casual.replyText : 'こんにちは。', {
      situationLine: casual && casual.replyText ? casual.replyText : 'こんにちは。',
      nextActions: [],
      pitfall: '',
      followupQuestion: '',
      defaultQuestion: '',
      disablePitfall: true,
      disableFollowup: true
    });
    const replyText = guardedReply.replyText;
    await payload.replyFn(payload.replyToken, { type: 'text', text: replyText });
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
      interventionBudget: opportunityDecision.interventionBudget
    });
    const conversationQuality = buildConversationQualityMeta({
      replyText,
      domainIntent: normalizedConversationIntent,
      opportunityReasonKeys: opportunityDecision.opportunityReasonKeys,
      fallbackType: null,
      legacyTemplateHit: guardedReply.legacyTemplateHit === true,
      pitfallIncluded: guardedReply.pitfallIncluded === true,
      followupQuestionIncluded: guardedReply.followupQuestionIncluded === true
    });
    await appendLlmActionLogBestEffort({
      lineUserId,
      plan: planInfo.plan,
      traceId,
      requestId,
      llmBanditEnabled,
      conversationMode: opportunityDecision.conversationMode,
      routerReason,
      opportunityType: opportunityDecision.opportunityType,
      opportunityReasonKeys: opportunityDecision.opportunityReasonKeys,
      interventionBudget: opportunityDecision.interventionBudget,
      domainIntent: normalizedConversationIntent,
      conversationQuality
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
      interventionBudget: 1
    });
    await appendLlmActionLogBestEffort({
      lineUserId,
      plan: planInfo.plan,
      traceId,
      requestId,
      conciergeMeta: domainConcierge && domainConcierge.conciergeMeta ? domainConcierge.conciergeMeta : null,
      llmBanditEnabled,
      conversationMode: 'concierge',
      routerReason,
      opportunityType: domainDecision.opportunityType,
      opportunityReasonKeys: domainDecision.opportunityReasonKeys,
      interventionBudget: 1,
      domainIntent: normalizedConversationIntent,
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
        interventionBudget: 1
      });
      await appendLlmActionLogBestEffort({
        lineUserId,
        plan: planInfo.plan,
        traceId,
        requestId,
        conciergeMeta: fallback && fallback.conciergeMeta ? fallback.conciergeMeta : null,
        llmBanditEnabled,
        conversationMode: 'concierge',
        routerReason: routerReason || 'paid_fallback_concierge',
        opportunityType: fallbackDecision.opportunityType,
        opportunityReasonKeys: fallbackDecision.opportunityReasonKeys,
        interventionBudget: 1,
        domainIntent: normalizedConversationIntent,
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
      const storedCandidates = await resolveStoredCandidatesForPaid(paid);
      const concierge = await composeConciergeReply({
        question: text,
        baseReplyText: replyText,
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
  replyText = guardedMainReply.replyText;
  await payload.replyFn(payload.replyToken, { type: 'text', text: replyText });

  const assistantQuality = normalizeAssistantQuality(paid.assistantQuality, {
    intentResolved: paidIntent,
    kbTopScore: paid.top1Score || 0,
    evidenceCoverage: Array.isArray(paid && paid.output && paid.output.evidenceKeys) && paid.output.evidenceKeys.length > 0
      ? 1
      : 0,
    blockedStage: null,
    fallbackReason: null
  });
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
    conversationQuality
  });
  await appendLlmActionLogBestEffort({
    lineUserId,
    plan: planInfo.plan,
    traceId,
    requestId,
    conciergeMeta,
    llmBanditEnabled,
    conversationMode,
    routerReason,
    opportunityType,
    opportunityReasonKeys,
    interventionBudget
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
  const [llmConciergeEnabled, llmWebSearchEnabled, llmStyleEngineEnabled, llmBanditEnabled] = await Promise.all([
    resolveLlmConciergeEnabledBestEffort(),
    resolveLlmWebSearchEnabledBestEffort(),
    resolveLlmStyleEngineEnabledBestEffort(),
    resolveLlmBanditEnabledBestEffort()
  ]);

  const userIds = extractUserIds(payload);
  const firstUserId = userIds[0] || '';
  const welcomeFn = (options && options.sendWelcomeFn) || sendWelcomeMessage;
  const replyFn = (options && options.replyFn) || replyMessage;
  const pushFn = (options && options.pushFn) || pushMessage || (async () => ({ status: 200 }));

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
            requestId
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
      if (text && replyToken) {
        try {
          const journey = await handleJourneyLineCommand({
            lineUserId: userId,
            text,
            traceId,
            requestId
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
