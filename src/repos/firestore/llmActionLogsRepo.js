'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'llm_action_logs';
const CONVERSATION_MODES = new Set(['casual', 'concierge']);
const ACTION_CLASSES = new Set(['lookup', 'draft', 'assist', 'human_only']);
const ACTION_GATEWAY_DECISIONS = new Set(['allow', 'clarify', 'block', 'bypass']);
const OPPORTUNITY_TYPES = new Set(['none', 'action', 'blocked', 'life']);
const STRATEGIES = new Set(['casual', 'domain_concierge', 'concierge', 'recommendation', 'clarify', 'grounded_answer']);
const RETRIEVAL_QUALITIES = new Set(['none', 'good', 'mixed', 'bad']);
const VERIFICATION_OUTCOMES = new Set(['passed', 'hedged', 'clarify', 'refuse']);
const INTENT_RISK_TIERS = new Set(['low', 'medium', 'high']);
const SOURCE_READINESS_DECISIONS = new Set(['allow', 'hedged', 'clarify', 'refuse']);
const READINESS_DECISIONS = new Set(['allow', 'hedged', 'clarify', 'refuse']);
const READINESS_SAFE_RESPONSE_MODES = new Set(['answer', 'answer_with_hedge', 'clarify', 'refuse']);
const FOLLOWUP_INTENTS = new Set(['docs_required', 'appointment_needed', 'next_step']);
const QUALITY_SLICE_KEYS = new Set([
  'paid',
  'free',
  'admin',
  'compat',
  'short_followup',
  'domain_continuation',
  'group_chat',
  'japanese_service_quality',
  'minority_personas',
  'cultural_slices'
]);
const CONTAMINATION_RISKS = new Set(['low', 'medium', 'high']);
const REPLAY_FAILURE_TYPES = new Set([
  'none',
  'stale_source',
  'contradictory_source',
  'evidence_swap',
  'quote_unsend',
  'redelivery'
]);

function normalizeString(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1000000000000 ? value : value * 1000);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date;
  }
  return null;
}

function normalizeStringList(value, limit) {
  const rows = Array.isArray(value) ? value : [];
  const max = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 20;
  const out = [];
  rows.forEach((item) => {
    if (out.length >= max) return;
    const normalized = normalizeString(item, '');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function normalizeChosenAction(value) {
  const payload = value && typeof value === 'object' ? value : {};
  return {
    armId: normalizeString(payload.armId, null),
    styleId: normalizeString(payload.styleId, null),
    ctaCount: Math.max(0, Math.floor(normalizeNumber(payload.ctaCount, 0))),
    questionFlag: normalizeBoolean(payload.questionFlag, false),
    lengthBucket: normalizeString(payload.lengthBucket, null),
    timingBucket: normalizeString(payload.timingBucket, null),
    score: normalizeNumber(payload.score, 0),
    selectionSource: normalizeString(payload.selectionSource, null),
    scoreBreakdown: payload.scoreBreakdown && typeof payload.scoreBreakdown === 'object'
      ? Object.assign({}, payload.scoreBreakdown)
      : {}
  };
}

function normalizeRewardSignals(value) {
  const payload = value && typeof value === 'object' ? value : {};
  const clickPrimary = payload.clickPrimary === true || payload.click === true;
  const clickSecondary = payload.clickSecondary === true;
  const taskDone = payload.taskDone === true || payload.taskComplete === true;
  return {
    click: clickPrimary || clickSecondary,
    clickPrimary,
    clickSecondary,
    taskDone,
    taskComplete: taskDone,
    blockedResolved: payload.blockedResolved === true,
    unsubscribe: payload.unsubscribe === true,
    spam: payload.spam === true,
    citationMissing: payload.citationMissing === true,
    wrongEvidence: payload.wrongEvidence === true
  };
}

function normalizeConversationMode(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return CONVERSATION_MODES.has(normalized) ? normalized : null;
}

function normalizeActionClass(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return ACTION_CLASSES.has(normalized) ? normalized : 'lookup';
}

function normalizeActionGatewayDecision(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return ACTION_GATEWAY_DECISIONS.has(normalized) ? normalized : null;
}

function normalizeOpportunityType(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return 'none';
  return OPPORTUNITY_TYPES.has(normalized) ? normalized : 'none';
}

function normalizeInterventionBudget(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num >= 1 ? 1 : 0;
}

function normalizeDomainIntent(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return 'general';
  if (['housing', 'school', 'ssn', 'banking'].includes(normalized)) return normalized;
  return 'general';
}

function normalizeContextResumeDomain(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  if (['housing', 'school', 'ssn', 'banking'].includes(normalized)) return normalized;
  return null;
}

function normalizeIntentRiskTier(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return 'low';
  return INTENT_RISK_TIERS.has(normalized) ? normalized : 'low';
}

function normalizeStrategy(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return STRATEGIES.has(normalized) ? normalized : null;
}

function normalizeRetrievalQuality(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return 'none';
  return RETRIEVAL_QUALITIES.has(normalized) ? normalized : 'none';
}

function normalizeVerificationOutcome(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return VERIFICATION_OUTCOMES.has(normalized) ? normalized : null;
}

function normalizeSourceReadinessDecision(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return SOURCE_READINESS_DECISIONS.has(normalized) ? normalized : null;
}

function normalizeReadinessDecision(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return READINESS_DECISIONS.has(normalized) ? normalized : null;
}

function normalizeReadinessSafeResponseMode(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return READINESS_SAFE_RESPONSE_MODES.has(normalized) ? normalized : null;
}

function normalizeFollowupIntent(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return FOLLOWUP_INTENTS.has(normalized) ? normalized : null;
}

function normalizeQualitySliceKey(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return QUALITY_SLICE_KEYS.has(normalized) ? normalized : null;
}

function normalizeContaminationRisk(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return CONTAMINATION_RISKS.has(normalized) ? normalized : null;
}

function normalizeReplayFailureType(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return 'none';
  return REPLAY_FAILURE_TYPES.has(normalized) ? normalized : 'none';
}

function normalizeJudgeScores(value) {
  const rows = Array.isArray(value) ? value : [];
  return rows.slice(0, 5).map((item, index) => {
    const row = item && typeof item === 'object' ? item : {};
    const metrics = row.metrics && typeof row.metrics === 'object' ? row.metrics : {};
    return {
      rank: index + 1,
      candidateId: normalizeString(row.candidateId, null),
      total: normalizeNumber(row.total, 0),
      rejectedReasons: normalizeStringList(row.rejectedReasons, 8),
      metrics: {
        sensibleness: normalizeNumber(metrics.sensibleness, 0),
        contextConsistency: normalizeNumber(metrics.contextConsistency, 0),
        taskProgress: normalizeNumber(metrics.taskProgress, 0),
        groundedness: normalizeNumber(metrics.groundedness, 0),
        naturalness: normalizeNumber(metrics.naturalness, 0),
        safety: normalizeNumber(metrics.safety, 0)
      }
    };
  }).filter((row) => row.candidateId);
}

function normalizeContextualFeatures(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    featureVersion: normalizeString(value.featureVersion, 'bandit_ctx_v1'),
    journeyPhase: normalizeString(value.journeyPhase, 'pre'),
    tier: normalizeString(value.tier, 'free'),
    mode: normalizeString(value.mode, 'A'),
    topic: normalizeString(value.topic, 'general'),
    riskBucket: normalizeString(value.riskBucket, 'low'),
    evidenceNeed: normalizeString(value.evidenceNeed, 'none'),
    styleId: normalizeString(value.styleId, null),
    ctaCount: Math.max(0, Math.floor(normalizeNumber(value.ctaCount, 0))),
    lengthBucket: normalizeString(value.lengthBucket, 'short'),
    timingBucket: normalizeString(value.timingBucket, 'daytime'),
    questionFlag: value.questionFlag === true,
    intentConfidence: normalizeNumber(value.intentConfidence, 0),
    contextConfidence: normalizeNumber(value.contextConfidence, 0),
    intentConfidenceBucket: normalizeString(value.intentConfidenceBucket, 'low'),
    contextConfidenceBucket: normalizeString(value.contextConfidenceBucket, 'low'),
    taskLoadBucket: normalizeString(value.taskLoadBucket, 'none'),
    topTaskCount: Math.max(0, Math.floor(normalizeNumber(value.topTaskCount, 0))),
    blockedTaskPresent: value.blockedTaskPresent === true,
    dueSoonTaskPresent: value.dueSoonTaskPresent === true
  };
}

function normalizeCounterfactualTopArms(value) {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .slice(0, 5)
    .map((item, index) => {
      const row = item && typeof item === 'object' ? item : {};
      return {
        rank: Number.isFinite(Number(row.rank)) ? Math.max(1, Math.floor(Number(row.rank))) : index + 1,
        armId: normalizeString(row.armId, null),
        styleId: normalizeString(row.styleId, null),
        ctaCount: Math.max(0, Math.floor(normalizeNumber(row.ctaCount, 0))),
        score: normalizeNumber(row.score, 0)
      };
    })
    .filter((row) => row.armId);
}

function normalizeCounterfactualEval(value) {
  const payload = value && typeof value === 'object' ? value : null;
  if (!payload) return null;
  return {
    version: normalizeString(payload.version, 'v1'),
    eligible: payload.eligible === true,
    selectedArmId: normalizeString(payload.selectedArmId, null),
    selectedRank: Number.isFinite(Number(payload.selectedRank))
      ? Math.max(1, Math.floor(Number(payload.selectedRank)))
      : null,
    bestArmId: normalizeString(payload.bestArmId, null),
    bestScore: normalizeNumber(payload.bestScore, 0),
    selectedScore: normalizeNumber(payload.selectedScore, 0),
    scoreGap: Math.max(0, normalizeNumber(payload.scoreGap, 0)),
    minGap: Math.max(0, normalizeNumber(payload.minGap, 0.12)),
    opportunityDetected: payload.opportunityDetected === true
  };
}

function resolveOptimizationVersion(payload) {
  const explicit = normalizeString(payload && payload.optimizationVersion, '');
  if (explicit) return explicit;
  const breakdown = payload && payload.scoreBreakdown && typeof payload.scoreBreakdown === 'object'
    ? payload.scoreBreakdown
    : {};
  const hasV2Weights = Number.isFinite(Number(breakdown.wStyle))
    || Number.isFinite(Number(breakdown.wTiming))
    || Number.isFinite(Number(breakdown.wCta));
  return hasV2Weights ? 'v2' : 'v1';
}

async function appendLlmActionLog(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const data = {
    traceId: normalizeString(payload.traceId, null),
    requestId: normalizeString(payload.requestId, null),
    lineUserId: normalizeString(payload.lineUserId, ''),
    plan: normalizeString(payload.plan, 'free'),
    userTier: normalizeString(payload.userTier, 'free'),
    mode: normalizeString(payload.mode, 'A'),
    topic: normalizeString(payload.topic, 'general'),
    intentConfidence: normalizeNumber(payload.intentConfidence, 0),
    contextConfidence: normalizeNumber(payload.contextConfidence, 0),
    conversationState: normalizeString(payload.conversationState, null),
    conversationMove: normalizeString(payload.conversationMove, null),
    styleId: normalizeString(payload.styleId, null),
    actionClass: normalizeActionClass(payload.actionClass),
    actionGatewayEnabled: payload.actionGatewayEnabled === true,
    actionGatewayEnforced: payload.actionGatewayEnforced === true,
    actionGatewayAllowed: payload.actionGatewayAllowed !== false,
    actionGatewayDecision: normalizeActionGatewayDecision(payload.actionGatewayDecision),
    actionGatewayReason: normalizeString(payload.actionGatewayReason, null),
    conversationMode: normalizeConversationMode(payload.conversationMode),
    routerReason: normalizeString(payload.routerReason, null),
    opportunityType: normalizeOpportunityType(payload.opportunityType),
    opportunityReasonKeys: normalizeStringList(payload.opportunityReasonKeys, 8),
    interventionBudget: normalizeInterventionBudget(payload.interventionBudget),
    conversationNaturalnessVersion: normalizeString(payload.conversationNaturalnessVersion, 'v1'),
    legacyTemplateHit: payload.legacyTemplateHit === true,
    followupQuestionIncluded: payload.followupQuestionIncluded === true,
    actionCount: Math.max(0, Math.min(3, Math.floor(normalizeNumber(payload.actionCount, 0)))),
    pitfallIncluded: payload.pitfallIncluded === true,
    domainIntent: normalizeDomainIntent(payload.domainIntent),
    intentRiskTier: normalizeIntentRiskTier(payload.intentRiskTier),
    riskReasonCodes: normalizeStringList(payload.riskReasonCodes, 8),
    fallbackType: normalizeString(payload.fallbackType, null),
    interventionSuppressedBy: normalizeString(payload.interventionSuppressedBy, null),
    sourceAuthorityScore: Math.max(0, Math.min(1, normalizeNumber(payload.sourceAuthorityScore, 0))),
    sourceFreshnessScore: Math.max(0, Math.min(1, normalizeNumber(payload.sourceFreshnessScore, 0))),
    sourceReadinessDecision: normalizeSourceReadinessDecision(payload.sourceReadinessDecision),
    sourceReadinessReasons: normalizeStringList(payload.sourceReadinessReasons, 8),
    officialOnlySatisfied: payload.officialOnlySatisfied === true,
    readinessDecision: normalizeReadinessDecision(payload.readinessDecision),
    readinessReasonCodes: normalizeStringList(payload.readinessReasonCodes, 12),
    readinessSafeResponseMode: normalizeReadinessSafeResponseMode(payload.readinessSafeResponseMode),
    unsupportedClaimCount: Math.max(0, Math.floor(normalizeNumber(payload.unsupportedClaimCount, 0))),
    contradictionDetected: payload.contradictionDetected === true,
    answerReadinessLogOnly: payload.answerReadinessLogOnly !== false,
    orchestratorPathUsed: payload.orchestratorPathUsed === true,
    contextResumeDomain: normalizeContextResumeDomain(payload.contextResumeDomain),
    loopBreakApplied: payload.loopBreakApplied === true,
    followupIntent: normalizeFollowupIntent(payload.followupIntent),
    followupIntentReason: normalizeString(payload.followupIntentReason, null),
    followupCarryFromHistory: payload.followupCarryFromHistory === true,
    conciseModeApplied: payload.conciseModeApplied === true,
    repetitionPrevented: payload.repetitionPrevented === true,
    directAnswerApplied: payload.directAnswerApplied === true,
    clarifySuppressed: payload.clarifySuppressed === true,
    misunderstandingRecovered: payload.misunderstandingRecovered === true,
    contextCarryScore: Math.max(0, Math.min(1, normalizeNumber(payload.contextCarryScore, 0))),
    repeatRiskScore: Math.max(0, Math.min(1, normalizeNumber(payload.repeatRiskScore, 0))),
    sliceKey: normalizeQualitySliceKey(payload.sliceKey),
    judgeConfidence: Math.max(0, Math.min(1, normalizeNumber(payload.judgeConfidence, 0))),
    judgeDisagreement: Math.max(0, Math.min(1, normalizeNumber(payload.judgeDisagreement, 0))),
    benchmarkVersion: normalizeString(payload.benchmarkVersion, null),
    contaminationRisk: normalizeContaminationRisk(payload.contaminationRisk),
    replayFailureType: normalizeReplayFailureType(payload.replayFailureType),
    latencyMs: Math.max(0, Math.floor(normalizeNumber(payload.latencyMs, 0))),
    costUsd: Math.max(0, normalizeNumber(payload.costUsd, 0)),
    strategy: normalizeStrategy(payload.strategy),
    retrieveNeeded: payload.retrieveNeeded === true,
    retrievalQuality: normalizeRetrievalQuality(payload.retrievalQuality),
    judgeWinner: normalizeString(payload.judgeWinner, null),
    judgeScores: normalizeJudgeScores(payload.judgeScores),
    verificationOutcome: normalizeVerificationOutcome(payload.verificationOutcome),
    contradictionFlags: normalizeStringList(payload.contradictionFlags, 8),
    candidateCount: Math.max(0, Math.min(5, Math.floor(normalizeNumber(payload.candidateCount, 0)))),
    humanReviewLabel: normalizeString(payload.humanReviewLabel, null),
    committedNextActions: normalizeStringList(payload.committedNextActions, 3),
    committedFollowupQuestion: normalizeString(payload.committedFollowupQuestion, null),
    recentUserGoal: normalizeString(payload.recentUserGoal, null),
    contextVersion: normalizeString(payload.contextVersion, 'concierge_ctx_v1'),
    featureHash: normalizeString(payload.featureHash, null),
    contextSignature: normalizeString(payload.contextSignature, null),
    segmentKey: normalizeString(payload.segmentKey, null),
    banditEnabled: payload.banditEnabled === true,
    contextualBanditEnabled: payload.contextualBanditEnabled === true,
    epsilon: normalizeNumber(payload.epsilon, 0.1),
    chosenAction: normalizeChosenAction(payload.chosenAction),
    selectionSource: normalizeString(payload.selectionSource, 'score'),
    score: normalizeNumber(payload.score, 0),
    scoreBreakdown: payload.scoreBreakdown && typeof payload.scoreBreakdown === 'object'
      ? Object.assign({}, payload.scoreBreakdown)
      : {},
    optimizationVersion: resolveOptimizationVersion(payload),
    evidenceNeed: normalizeString(payload.evidenceNeed, 'none'),
    evidenceOutcome: normalizeString(payload.evidenceOutcome, 'SUPPORTED'),
    urlCount: Math.max(0, Math.floor(normalizeNumber(payload.urlCount, 0))),
    citationRanks: normalizeStringList(payload.citationRanks, 8),
    blockedReasons: normalizeStringList(payload.blockedReasons, 16),
    injectionFindings: payload.injectionFindings === true,
    postRenderLint: payload.postRenderLint && typeof payload.postRenderLint === 'object'
      ? {
          findings: normalizeStringList(payload.postRenderLint.findings, 16),
          modified: payload.postRenderLint.modified === true
        }
      : { findings: [], modified: false },
    contextualFeatures: normalizeContextualFeatures(payload.contextualFeatures),
    counterfactualSelectedArmId: normalizeString(payload.counterfactualSelectedArmId, null),
    counterfactualSelectedRank: Number.isFinite(Number(payload.counterfactualSelectedRank))
      ? Math.max(1, Math.floor(Number(payload.counterfactualSelectedRank)))
      : null,
    counterfactualTopArms: normalizeCounterfactualTopArms(payload.counterfactualTopArms),
    counterfactualEval: normalizeCounterfactualEval(payload.counterfactualEval),
    rewardPending: payload.rewardPending !== false,
    reward: Number.isFinite(Number(payload.reward)) ? Number(payload.reward) : null,
    rewardVersion: normalizeString(payload.rewardVersion, 'v1'),
    rewardWindowHours: Math.max(1, Math.min(24 * 14, Math.floor(normalizeNumber(payload.rewardWindowHours, 48)))),
    rewardSignals: normalizeRewardSignals(payload.rewardSignals),
    createdAt: payload.createdAt || serverTimestamp(),
    updatedAt: payload.updatedAt || serverTimestamp()
  };
  await docRef.set(data, { merge: false });
  return { id: docRef.id, data };
}

async function listLlmActionLogsByCreatedAtRange(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = Number.isInteger(payload.limit) && payload.limit > 0 ? Math.min(payload.limit, 5000) : 1000;
  const fromAt = toDate(payload.fromAt);
  const toAt = toDate(payload.toAt);
  const db = getDb();

  let query = db.collection(COLLECTION);
  if (fromAt) query = query.where('createdAt', '>=', fromAt);
  if (toAt) query = query.where('createdAt', '<=', toAt);
  const snap = await query.orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

async function listPendingLlmActionLogs(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.min(500, Math.floor(Number(payload.limit)))) : 100;
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('rewardPending', '==', true).limit(limit).get();
  return snap.docs
    .map((doc) => Object.assign({ id: doc.id }, doc.data()))
    .sort((a, b) => {
      const left = toDate(a && a.createdAt);
      const right = toDate(b && b.createdAt);
      return (left ? left.getTime() : 0) - (right ? right.getTime() : 0);
    });
}

async function listLlmActionLogsByLineUserId(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeString(payload.lineUserId, '');
  if (!lineUserId) return [];
  const limit = Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.min(300, Math.floor(Number(payload.limit)))) : 100;
  const fromAt = toDate(payload.fromAt);
  const toAt = toDate(payload.toAt);
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('lineUserId', '==', lineUserId).limit(limit).get();
  return snap.docs
    .map((doc) => Object.assign({ id: doc.id }, doc.data()))
    .filter((row) => {
      const at = toDate(row && row.createdAt);
      if (!at) return false;
      if (fromAt && at.getTime() < fromAt.getTime()) return false;
      if (toAt && at.getTime() > toAt.getTime()) return false;
      return true;
    })
    .sort((a, b) => {
      const left = toDate(a && a.createdAt);
      const right = toDate(b && b.createdAt);
      return (left ? left.getTime() : 0) - (right ? right.getTime() : 0);
    });
}

async function patchLlmActionLog(id, patch) {
  const docId = normalizeString(id, '');
  if (!docId) throw new Error('id required');
  const payload = patch && typeof patch === 'object' ? patch : {};
  const data = Object.assign({}, payload, { updatedAt: payload.updatedAt || serverTimestamp() });
  const db = getDb();
  await db.collection(COLLECTION).doc(docId).set(data, { merge: true });
  return { id: docId, data };
}

module.exports = {
  COLLECTION,
  appendLlmActionLog,
  listLlmActionLogsByCreatedAtRange,
  listPendingLlmActionLogs,
  listLlmActionLogsByLineUserId,
  patchLlmActionLog,
  toDate,
  normalizeRewardSignals
};
