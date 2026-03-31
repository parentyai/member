'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');
const { assertRecordEnvelopeCompliance } = require('../../domain/data/universalRecordEnvelopeCompliance');
const {
  normalizeTranscriptSnapshotOutcome,
  normalizeTranscriptSnapshotReason,
  normalizeTranscriptSnapshotBuildSkippedReason
} = require('../../domain/qualityPatrol/transcript/buildTranscriptCoverageDiagnostics');

const COLLECTION = 'llm_action_logs';
const ENTRY_TYPES = new Set(['webhook', 'admin', 'compat', 'job', 'unknown']);
const CONVERSATION_MODES = new Set(['casual', 'concierge']);
const ACTION_CLASSES = new Set(['lookup', 'draft', 'assist', 'human_only']);
const ACTION_GATEWAY_DECISIONS = new Set(['allow', 'clarify', 'block', 'bypass']);
const OPPORTUNITY_TYPES = new Set(['none', 'action', 'blocked', 'life']);
const STRATEGIES = new Set(['casual', 'domain_concierge', 'concierge', 'recommendation', 'clarify', 'grounded_answer']);
const RETRIEVAL_QUALITIES = new Set(['none', 'good', 'mixed', 'bad']);
const VERIFICATION_OUTCOMES = new Set(['passed', 'hedged', 'clarify', 'refuse']);
const CANDIDATE_KINDS = new Set([
  'none',
  'grounded_candidate',
  'city_grounded_candidate',
  'city_pack_backed_candidate',
  'structured_answer_candidate',
  'continuation_candidate',
  'knowledge_backed_candidate',
  'housing_knowledge_candidate',
  'saved_faq_candidate',
  'clarify_candidate',
  'domain_concierge_candidate',
  'composed_concierge_candidate',
  'conversation_candidate',
  'casual_candidate',
  'refuse_candidate'
]);
const TEMPLATE_KINDS = new Set([
  'generic_fallback',
  'domain_concierge_template',
  'clarify_template',
  'grounded_answer_template',
  'casual_template',
  'refuse_template'
]);
const GENERIC_FALLBACK_SLICES = new Set(['broad', 'housing', 'city', 'followup', 'other']);
const INTENT_RISK_TIERS = new Set(['low', 'medium', 'high']);
const SOURCE_READINESS_DECISIONS = new Set(['allow', 'hedged', 'clarify', 'refuse']);
const READINESS_DECISIONS = new Set(['allow', 'hedged', 'clarify', 'refuse']);
const READINESS_SAFE_RESPONSE_MODES = new Set(['answer', 'answer_with_hedge', 'clarify', 'refuse']);
const FOLLOWUP_INTENTS = new Set(['docs_required', 'appointment_needed', 'next_step']);
const SERVICE_SURFACES = new Set(['text', 'quick_reply', 'flex', 'template', 'liff', 'mini_app', 'push', 'service_message']);
const HANDOFF_STATES = new Set(['NONE', 'OFFERED', 'REQUIRED', 'IN_PROGRESS', 'COMPLETED']);
const PATH_TYPES = new Set(['fast', 'slow', 'unknown']);
const GROUP_PRIVACY_MODES = new Set(['direct', 'group_safe']);
const PARENT_INTENT_TYPES = new Set([
  'NEXT_STEP',
  'HOW_TO',
  'DOCUMENTS_REQUIRED',
  'ELIGIBILITY_CHECK',
  'DEADLINE_CHECK',
  'STATUS_EXPLANATION',
  'STATE_RULE_DIFF',
  'TIMELINE_PLAN',
  'BLOCKER_HELP',
  'EXCEPTION_ESCALATION',
  'COST_ESTIMATE',
  'RETURN_PLAN',
  'GENERAL_OVERVIEW'
]);
const PARENT_ANSWER_MODES = new Set([
  'ACTION_PLAN',
  'CHECKLIST',
  'EXPLANATION',
  'COMPARISON',
  'WARNING_ONLY',
  'ESCALATION_NOTICE',
  'TIMELINE',
  'REVERSE_LOOKUP'
]);
const PARENT_LIFECYCLE_STAGES = new Set([
  'PRE_ASSIGNMENT',
  'PRE_DEPARTURE',
  'ENTRY_TRAVEL',
  'ARRIVAL_0_7',
  'ARRIVAL_0_30',
  'SETTLEMENT_30_90',
  'STEADY_STATE',
  'RENEWAL_CHANGE',
  'RETURN_REPAT'
]);
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

function normalizeReasonList(value, limit) {
  return normalizeStringList(value, limit).map((item) => item.toLowerCase().replace(/\s+/g, '_'));
}

function normalizePlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.assign({}, value)
    : null;
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

function isSyntheticPatrolReplayRow(row) {
  const traceId = normalizeString(row && row.traceId, '');
  const requestId = normalizeString(row && row.requestId, '');
  return traceId.startsWith('quality_patrol_cycle_')
    || traceId.startsWith('quality_patrol_replay_')
    || requestId.startsWith('quality_patrol_cycle_')
    || requestId.startsWith('quality_patrol_replay_');
}

function normalizeConversationMode(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return CONVERSATION_MODES.has(normalized) ? normalized : null;
}

function normalizeEntryType(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return 'unknown';
  return ENTRY_TYPES.has(normalized) ? normalized : 'unknown';
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

function normalizeCandidateKind(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return CANDIDATE_KINDS.has(normalized) ? normalized : null;
}

function normalizeTemplateKind(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return TEMPLATE_KINDS.has(normalized) ? normalized : null;
}

function normalizeGenericFallbackSlice(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return GENERIC_FALLBACK_SLICES.has(normalized) ? normalized : 'other';
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

function normalizeServiceSurface(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return SERVICE_SURFACES.has(normalized) ? normalized : 'text';
}

function normalizeHandoffState(value) {
  const normalized = normalizeString(value, '').toUpperCase();
  if (!normalized) return null;
  return HANDOFF_STATES.has(normalized) ? normalized : null;
}

function normalizePathType(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return PATH_TYPES.has(normalized) ? normalized : 'unknown';
}

function normalizeGroupPrivacyMode(value) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return null;
  return GROUP_PRIVACY_MODES.has(normalized) ? normalized : 'direct';
}

function normalizeKnowledgeCandidateCountBySource(value) {
  const payload = value && typeof value === 'object' ? value : {};
  const clampCount = (input) => {
    const num = Number(input);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(50, Math.floor(num)));
  };
  return {
    faq: clampCount(payload.faq),
    savedFaq: clampCount(payload.savedFaq),
    cityPack: clampCount(payload.cityPack),
    sourceRefs: clampCount(payload.sourceRefs),
    webSearch: clampCount(payload.webSearch)
  };
}

function normalizeParentIntentType(value) {
  const normalized = normalizeString(value, '').toUpperCase();
  if (!normalized) return null;
  return PARENT_INTENT_TYPES.has(normalized) ? normalized : null;
}

function normalizeParentAnswerMode(value) {
  const normalized = normalizeString(value, '').toUpperCase();
  if (!normalized) return null;
  return PARENT_ANSWER_MODES.has(normalized) ? normalized : null;
}

function normalizeParentLifecycleStage(value) {
  const normalized = normalizeString(value, '').toUpperCase();
  if (!normalized) return null;
  return PARENT_LIFECYCLE_STAGES.has(normalized) ? normalized : null;
}

function normalizeParentChapter(value) {
  const normalized = normalizeString(value, '').toUpperCase();
  if (!normalized) return null;
  return /^[A-Z]$/.test(normalized) ? normalized : null;
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

function normalizeNullableBoolean(value) {
  if (typeof value === 'boolean') return value;
  return null;
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
        candidatePriority: normalizeNumber(metrics.candidatePriority, 0),
        strategyAlignmentPriority: normalizeNumber(metrics.strategyAlignmentPriority, 0),
        sensibleness: normalizeNumber(metrics.sensibleness, 0),
        contextConsistency: normalizeNumber(metrics.contextConsistency, 0),
        taskProgress: normalizeNumber(metrics.taskProgress, 0),
        groundedness: normalizeNumber(metrics.groundedness, 0),
        naturalness: normalizeNumber(metrics.naturalness, 0),
        safety: normalizeNumber(metrics.safety, 0),
        directAnswerFit: normalizeNumber(metrics.directAnswerFit, 0)
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
  const recordEnvelope = buildUniversalRecordEnvelope({
    recordId: docRef.id,
    recordType: 'llm_action_log',
    sourceSystem: 'member_firestore',
    sourceSnapshotRef: normalizeString(payload.sourceSnapshotRef, 'snapshot:llm_action_logs'),
    effectiveFrom: payload.createdAt || new Date().toISOString(),
    authorityTier: normalizeString(payload.authorityTier, 'T2_PUBLIC_DATA'),
    bindingLevel: normalizeString(payload.bindingLevel, 'RECOMMENDED'),
    status: 'active',
    retentionTag: 'llm_action_logs_180d',
    piiClass: 'indirect_identifier',
    accessScope: ['operator', 'llm_runtime'],
    maskingPolicy: 'trace_summary_masked',
    deletionPolicy: 'retention_policy_v1',
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || payload.createdAt || new Date().toISOString()
  });
  assertRecordEnvelopeCompliance({ dataClass: 'llm_action_logs', recordEnvelope });
  const data = {
    traceId: normalizeString(payload.traceId, null),
    requestId: normalizeString(payload.requestId, null),
    entryType: normalizeEntryType(payload.entryType),
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
    routerReasonObserved: payload.routerReasonObserved === true
      ? true
      : (payload.routerReasonObserved === false ? false : null),
    routeKind: normalizeString(payload.routeKind, null),
    compatFallbackReason: normalizeString(payload.compatFallbackReason, null),
    sharedReadinessBridge: normalizeString(payload.sharedReadinessBridge, null),
    sharedReadinessBridgeObserved: payload.sharedReadinessBridgeObserved === true
      ? true
      : (payload.sharedReadinessBridgeObserved === false ? false : null),
    routeDecisionSource: normalizeString(payload.routeDecisionSource, null),
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
    responseContractConformant: payload.responseContractConformant !== false,
    responseContractErrorCount: Math.max(0, Math.min(12, Math.floor(normalizeNumber(payload.responseContractErrorCount, 0)))),
    responseContractErrors: normalizeStringList(payload.responseContractErrors, 12),
    responseContractFallbackApplied: payload.responseContractFallbackApplied === true,
    contractVersion: normalizeString(payload.contractVersion, null),
    pathType: normalizePathType(payload.pathType),
    uUnits: normalizeStringList(payload.uUnits, 12),
    serviceSurface: normalizeServiceSurface(payload.serviceSurface),
    groupPrivacyMode: normalizeGroupPrivacyMode(payload.groupPrivacyMode),
    handoffState: normalizeHandoffState(payload.handoffState),
    memoryReadScopes: normalizeStringList(payload.memoryReadScopes, 6),
    memoryWriteScopes: normalizeStringList(payload.memoryWriteScopes, 6),
    citationFinalized: typeof payload.citationFinalized === 'boolean' ? payload.citationFinalized : null,
    citationFreshnessStatus: normalizeString(payload.citationFreshnessStatus, null),
    citationAuthoritySatisfied: typeof payload.citationAuthoritySatisfied === 'boolean'
      ? payload.citationAuthoritySatisfied
      : null,
    citationDisclaimerRequired: typeof payload.citationDisclaimerRequired === 'boolean'
      ? payload.citationDisclaimerRequired
      : null,
    policySourceResolved: normalizeString(payload.policySourceResolved, null),
    policyGate: normalizeString(payload.policyGate, null),
    policyDisclosureRequired: typeof payload.policyDisclosureRequired === 'boolean'
      ? payload.policyDisclosureRequired
      : null,
    policyEscalationRequired: typeof payload.policyEscalationRequired === 'boolean'
      ? payload.policyEscalationRequired
      : null,
    sourceAuthorityScore: Math.max(0, Math.min(1, normalizeNumber(payload.sourceAuthorityScore, 0))),
    sourceFreshnessScore: Math.max(0, Math.min(1, normalizeNumber(payload.sourceFreshnessScore, 0))),
    sourceReadinessDecision: normalizeSourceReadinessDecision(payload.sourceReadinessDecision),
    sourceReadinessReasons: normalizeStringList(payload.sourceReadinessReasons, 8),
    evidenceCoverage: Number.isFinite(Number(payload.evidenceCoverage))
      ? Math.max(0, Math.min(1, Number(payload.evidenceCoverage)))
      : null,
    evidenceCoverageObserved: payload.evidenceCoverageObserved === true
      ? true
      : (payload.evidenceCoverageObserved === false ? false : null),
    officialOnlySatisfied: payload.officialOnlySatisfied === true,
    officialOnlySatisfiedObserved: payload.officialOnlySatisfiedObserved === true
      ? true
      : (payload.officialOnlySatisfiedObserved === false ? false : null),
    readinessDecision: normalizeReadinessDecision(payload.readinessDecision),
    readinessReasonCodes: normalizeStringList(payload.readinessReasonCodes, 12),
    readinessSafeResponseMode: normalizeReadinessSafeResponseMode(payload.readinessSafeResponseMode),
    answerReadinessVersion: normalizeString(payload.answerReadinessVersion, null),
    responseQualityContextVersion: normalizeString(payload.responseQualityContextVersion, null),
    responseQualityVerdictVersion: normalizeString(payload.responseQualityVerdictVersion, null),
    answerReadinessLogOnlyV2: payload.answerReadinessLogOnlyV2 === true,
    answerReadinessEnforcedV2: payload.answerReadinessEnforcedV2 === true,
    answerReadinessV2Mode: normalizeString(payload.answerReadinessV2Mode, null),
    answerReadinessV2Stage: normalizeString(payload.answerReadinessV2Stage, null),
    answerReadinessV2EnforcementReason: normalizeString(payload.answerReadinessV2EnforcementReason, null),
    readinessDecisionSource: normalizeString(payload.readinessDecisionSource, null),
    readinessDecisionSourceV2: normalizeString(payload.readinessDecisionSourceV2, null),
    readinessHardeningVersion: normalizeString(payload.readinessHardeningVersion, null),
    readinessDecisionV2: normalizeReadinessDecision(payload.readinessDecisionV2),
    readinessReasonCodesV2: normalizeStringList(payload.readinessReasonCodesV2, 12),
    readinessSafeResponseModeV2: normalizeReadinessSafeResponseMode(payload.readinessSafeResponseModeV2),
    emergencyContextActive: payload.emergencyContextActive === true,
    emergencyOfficialSourceSatisfied: payload.emergencyOfficialSourceSatisfied === true,
    emergencyOfficialSourceSatisfiedObserved: payload.emergencyOfficialSourceSatisfiedObserved === true
      ? true
      : (payload.emergencyOfficialSourceSatisfiedObserved === false ? false : null),
    emergencyOverrideApplied: payload.emergencyOverrideApplied === true
      ? true
      : (payload.emergencyOverrideApplied === false ? false : null),
    emergencyEventId: normalizeString(payload.emergencyEventId, null),
    emergencyRegionKey: normalizeString(payload.emergencyRegionKey, null),
    emergencySourceSnapshot: normalizePlainObject(payload.emergencySourceSnapshot),
    journeyPhase: normalizeString(payload.journeyPhase, null),
    taskBlockerDetected: payload.taskBlockerDetected === true,
    journeyAlignedAction: typeof payload.journeyAlignedAction === 'boolean' ? payload.journeyAlignedAction : true,
    journeyAlignedActionObserved: payload.journeyAlignedActionObserved === true
      ? true
      : (payload.journeyAlignedActionObserved === false ? false : null),
    blockedTask: normalizePlainObject(payload.blockedTask),
    taskGraphState: normalizePlainObject(payload.taskGraphState),
    nextActionCandidates: normalizeStringList(payload.nextActionCandidates, 8),
    nextActions: normalizeStringList(payload.nextActions, 8),
    cityPackContext: payload.cityPackContext === true,
    cityPackGrounded: payload.cityPackGrounded === true,
    cityPackGroundedObserved: payload.cityPackGroundedObserved === true
      ? true
      : (payload.cityPackGroundedObserved === false ? false : null),
    cityPackGroundingReason: normalizeString(payload.cityPackGroundingReason, null),
    cityPackFreshnessScore: Math.max(0, Math.min(1, normalizeNumber(payload.cityPackFreshnessScore, 0))),
    cityPackAuthorityScore: Math.max(0, Math.min(1, normalizeNumber(payload.cityPackAuthorityScore, 0))),
    cityPackRequiredSourcesSatisfied: typeof payload.cityPackRequiredSourcesSatisfied === 'boolean'
      ? payload.cityPackRequiredSourcesSatisfied
      : null,
    cityPackSourceSnapshot: normalizePlainObject(payload.cityPackSourceSnapshot),
    cityPackPackId: normalizeString(payload.cityPackPackId, null),
    cityPackValidation: normalizePlainObject(payload.cityPackValidation),
    staleSourceBlocked: payload.staleSourceBlocked === true
      ? true
      : (payload.staleSourceBlocked === false ? false : null),
    staleSourceBlockedObserved: payload.staleSourceBlockedObserved === true
      ? true
      : (payload.staleSourceBlockedObserved === false ? false : null),
    savedFaqReused: payload.savedFaqReused === true,
    savedFaqReusePass: payload.savedFaqReusePass === true,
    savedFaqReusePassObserved: payload.savedFaqReusePassObserved === true
      ? true
      : (payload.savedFaqReusePassObserved === false ? false : null),
    savedFaqReuseReasonCodes: normalizeStringList(payload.savedFaqReuseReasonCodes, 8),
    savedFaqValid: typeof payload.savedFaqValid === 'boolean' ? payload.savedFaqValid : null,
    savedFaqAllowedIntent: typeof payload.savedFaqAllowedIntent === 'boolean' ? payload.savedFaqAllowedIntent : null,
    savedFaqAuthorityScore: Math.max(0, Math.min(1, normalizeNumber(payload.savedFaqAuthorityScore, 0))),
    crossSystemConflictDetected: payload.crossSystemConflictDetected === true,
    sourceSnapshotRefs: normalizeStringList(payload.sourceSnapshotRefs, 8),
    unsupportedClaimCount: Math.max(0, Math.floor(normalizeNumber(payload.unsupportedClaimCount, 0))),
    contradictionDetected: payload.contradictionDetected === true,
    answerReadinessLogOnly: payload.answerReadinessLogOnly !== false,
    orchestratorPathUsed: payload.orchestratorPathUsed === true,
    contextResumeDomain: normalizeContextResumeDomain(payload.contextResumeDomain),
    loopBreakApplied: payload.loopBreakApplied === true,
    followupIntent: normalizeFollowupIntent(payload.followupIntent),
    strategyReason: normalizeString(payload.strategyReason, null),
    strategyAlternativeSet: normalizeReasonList(payload.strategyAlternativeSet, 8),
    strategyPriorityVersion: normalizeString(payload.strategyPriorityVersion, null),
    fallbackPriorityReason: normalizeString(payload.fallbackPriorityReason, null),
    selectedCandidateKind: normalizeCandidateKind(payload.selectedCandidateKind),
    selectedByDirectAnswerFirst: payload.selectedByDirectAnswerFirst === true,
    retrievalBlockedByStrategy: payload.retrievalBlockedByStrategy === true,
    retrievalBlockReason: normalizeString(payload.retrievalBlockReason, null),
    retrievalPermitReason: normalizeString(payload.retrievalPermitReason, null),
    retrievalReenabledBySlice: normalizeGenericFallbackSlice(payload.retrievalReenabledBySlice),
    fallbackTemplateKind: normalizeTemplateKind(payload.fallbackTemplateKind),
    finalizerTemplateKind: normalizeTemplateKind(payload.finalizerTemplateKind),
    replyTemplateFingerprint: normalizeString(payload.replyTemplateFingerprint, null),
    priorContextUsed: payload.priorContextUsed === true,
    followupResolvedFromHistory: payload.followupResolvedFromHistory === true,
    continuationReason: normalizeString(payload.continuationReason, null),
    transcriptSnapshotOutcome: normalizeTranscriptSnapshotOutcome(payload.transcriptSnapshotOutcome),
    transcriptSnapshotReason: normalizeTranscriptSnapshotReason(payload.transcriptSnapshotReason),
    transcriptSnapshotLineUserKeyAvailable: normalizeNullableBoolean(payload.transcriptSnapshotLineUserKeyAvailable),
    transcriptSnapshotUserMessageAvailable: normalizeNullableBoolean(payload.transcriptSnapshotUserMessageAvailable),
    transcriptSnapshotAssistantReplyAvailable: normalizeNullableBoolean(payload.transcriptSnapshotAssistantReplyAvailable),
    transcriptSnapshotPriorContextSummaryAvailable: normalizeNullableBoolean(payload.transcriptSnapshotPriorContextSummaryAvailable),
    transcriptSnapshotAssistantReplyPresent: normalizeNullableBoolean(payload.transcriptSnapshotAssistantReplyPresent),
    transcriptSnapshotAssistantReplyLength: Number.isFinite(Number(payload.transcriptSnapshotAssistantReplyLength))
      ? Math.max(0, Math.floor(Number(payload.transcriptSnapshotAssistantReplyLength)))
      : null,
    transcriptSnapshotSanitizedReplyLength: Number.isFinite(Number(payload.transcriptSnapshotSanitizedReplyLength))
      ? Math.max(0, Math.floor(Number(payload.transcriptSnapshotSanitizedReplyLength)))
      : null,
    transcriptSnapshotBuildAttempted: normalizeNullableBoolean(payload.transcriptSnapshotBuildAttempted),
    transcriptSnapshotBuildSkippedReason: normalizeTranscriptSnapshotBuildSkippedReason(payload.transcriptSnapshotBuildSkippedReason),
    knowledgeCandidateCountBySource: normalizeKnowledgeCandidateCountBySource(payload.knowledgeCandidateCountBySource),
    knowledgeCandidateUsed: payload.knowledgeCandidateUsed === true,
    knowledgeCandidateRejectedReason: normalizeString(payload.knowledgeCandidateRejectedReason, null),
    knowledgeRejectedReasons: normalizeReasonList(payload.knowledgeRejectedReasons, 8),
    cityPackCandidateAvailable: payload.cityPackCandidateAvailable === true,
    cityPackRejectedReason: normalizeString(payload.cityPackRejectedReason, null),
    cityPackUsedInAnswer: payload.cityPackUsedInAnswer === true,
    savedFaqCandidateAvailable: payload.savedFaqCandidateAvailable === true,
    savedFaqRejectedReason: normalizeString(payload.savedFaqRejectedReason, null),
    savedFaqUsedInAnswer: payload.savedFaqUsedInAnswer === true,
    sourceReadinessDecisionSource: normalizeString(payload.sourceReadinessDecisionSource, null),
    knowledgeGroundingKind: normalizeString(payload.knowledgeGroundingKind, null),
    groundedCandidateAvailable: payload.groundedCandidateAvailable === true,
    structuredCandidateAvailable: payload.structuredCandidateAvailable === true,
    continuationCandidateAvailable: payload.continuationCandidateAvailable === true,
    genericFallbackSlice: normalizeGenericFallbackSlice(payload.genericFallbackSlice),
    parentIntentType: normalizeParentIntentType(payload.parentIntentType),
    parentAnswerMode: normalizeParentAnswerMode(payload.parentAnswerMode),
    parentLifecycleStage: normalizeParentLifecycleStage(payload.parentLifecycleStage),
    parentChapter: normalizeParentChapter(payload.parentChapter),
    parentRoutingInvariantStatus: normalizeString(payload.parentRoutingInvariantStatus, null),
    parentRoutingInvariantErrors: normalizeStringList(payload.parentRoutingInvariantErrors, 8),
    requiredCoreFactsComplete: payload.requiredCoreFactsComplete === true,
    missingRequiredCoreFacts: normalizeStringList(payload.missingRequiredCoreFacts, 12),
    missingRequiredCoreFactsCount: Math.max(0, Math.min(12, Math.floor(normalizeNumber(payload.missingRequiredCoreFactsCount, 0)))),
    requiredCoreFactsCriticalMissingCount: Math.max(0, Math.min(12, Math.floor(normalizeNumber(payload.requiredCoreFactsCriticalMissingCount, 0)))),
    requiredCoreFactsGateDecision: normalizeReadinessDecision(payload.requiredCoreFactsGateDecision),
    requiredCoreFactsGateLogOnly: payload.requiredCoreFactsGateLogOnly === true,
    followupIntentReason: normalizeString(payload.followupIntentReason, null),
    followupCarryFromHistory: payload.followupCarryFromHistory === true,
    conciseModeApplied: payload.conciseModeApplied === true,
    repetitionPrevented: payload.repetitionPrevented === true,
    directAnswerApplied: payload.directAnswerApplied === true,
    clarifySuppressed: payload.clarifySuppressed === true,
    misunderstandingRecovered: payload.misunderstandingRecovered === true,
    contextCarryScore: Math.max(0, Math.min(1, normalizeNumber(payload.contextCarryScore, 0))),
    repeatRiskScore: Math.max(0, Math.min(1, normalizeNumber(payload.repeatRiskScore, 0))),
    requestShape: normalizeString(payload.requestShape, null),
    depthIntent: normalizeString(payload.depthIntent, null),
    transformSource: normalizeString(payload.transformSource, null),
    outputForm: normalizeString(payload.outputForm, null),
    knowledgeScope: normalizeString(payload.knowledgeScope, null),
    locationHintKind: normalizeString(payload.locationHintKind, null),
    locationHintCityKey: normalizeString(payload.locationHintCityKey, null),
    locationHintState: normalizeString(payload.locationHintState, null),
    locationHintRegionKey: normalizeString(payload.locationHintRegionKey, null),
    detailObligations: normalizeReasonList(payload.detailObligations, 12),
    answerability: normalizeString(payload.answerability, null),
    echoOfPriorAssistant: typeof payload.echoOfPriorAssistant === 'boolean' ? payload.echoOfPriorAssistant : null,
    procedureKnowledgeUsed: typeof payload.procedureKnowledgeUsed === 'boolean' ? payload.procedureKnowledgeUsed : null,
    replyObjective: normalizeString(payload.replyObjective, null),
    answerMode: normalizeString(payload.answerMode, null),
    knowledgeMode: normalizeString(payload.knowledgeMode, null),
    procedureComplexity: normalizeString(payload.procedureComplexity, null),
    fitRisk: normalizeString(payload.fitRisk, null),
    relevanceAnchor: normalizeString(payload.relevanceAnchor, null),
    decisionCriticalMissingFacts: normalizeStringList(payload.decisionCriticalMissingFacts, 12),
    officialCheckTargets: normalizeStringList(payload.officialCheckTargets, 8),
    decisionCriticalMissingFactCount: Math.max(0, Math.min(12, Math.floor(normalizeNumber(payload.decisionCriticalMissingFactCount, 0)))),
    officialCheckTargetCount: Math.max(0, Math.min(8, Math.floor(normalizeNumber(payload.officialCheckTargetCount, 0)))),
    rawSourceLayerCount: Math.max(0, Math.min(8, Math.floor(normalizeNumber(payload.rawSourceLayerCount, 0)))),
    procedureKnowledgeEntryCount: Math.max(0, Math.min(8, Math.floor(normalizeNumber(payload.procedureKnowledgeEntryCount, 0)))),
    communityRawSourceCount: Math.max(0, Math.min(8, Math.floor(normalizeNumber(payload.communityRawSourceCount, 0)))),
    officialRawSourceCount: Math.max(0, Math.min(8, Math.floor(normalizeNumber(payload.officialRawSourceCount, 0)))),
    procedureScaffoldPartCount: Math.max(0, Math.min(5, Math.floor(normalizeNumber(payload.procedureScaffoldPartCount, 0)))),
    procedureScaffoldCovered: typeof payload.procedureScaffoldCovered === 'boolean' ? payload.procedureScaffoldCovered : null,
    oneTurnUtility: typeof payload.oneTurnUtility === 'boolean' ? payload.oneTurnUtility : null,
    decisionReadiness: typeof payload.decisionReadiness === 'boolean' ? payload.decisionReadiness : null,
    dependencyExplicitness: typeof payload.dependencyExplicitness === 'boolean' ? payload.dependencyExplicitness : null,
    relevanceFit: typeof payload.relevanceFit === 'boolean' ? payload.relevanceFit : null,
    offTargetAnswer: typeof payload.offTargetAnswer === 'boolean' ? payload.offTargetAnswer : null,
    fakeSpecificity: typeof payload.fakeSpecificity === 'boolean' ? payload.fakeSpecificity : null,
    userEffortShift: typeof payload.userEffortShift === 'boolean' ? payload.userEffortShift : null,
    transformBadFactCarry: typeof payload.transformBadFactCarry === 'boolean' ? payload.transformBadFactCarry : null,
    requestedCityKey: normalizeString(payload.requestedCityKey, null),
    matchedCityKey: normalizeString(payload.matchedCityKey, null),
    citySpecificitySatisfied: typeof payload.citySpecificitySatisfied === 'boolean' ? payload.citySpecificitySatisfied : null,
    citySpecificityReason: normalizeString(payload.citySpecificityReason, null),
    scopeDisclosureRequired: typeof payload.scopeDisclosureRequired === 'boolean' ? payload.scopeDisclosureRequired : null,
    violationCodes: normalizeReasonList(payload.violationCodes, 16),
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
    recordEnvelope,
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
  const snap = await db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs
    .map((doc) => Object.assign({ id: doc.id }, doc.data()))
    .filter((row) => {
      const at = toDate(row && row.createdAt);
      if (!at) return false;
      if (fromAt && at.getTime() < fromAt.getTime()) return false;
      if (toAt && at.getTime() > toAt.getTime()) return false;
      return true;
    });
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
  const excludeSyntheticPatrolReplay = payload.excludeSyntheticPatrolReplay === true;
  const queryLimit = excludeSyntheticPatrolReplay
    ? Math.max(limit, Math.min(300, limit * 10))
    : limit;
  const fromAt = toDate(payload.fromAt);
  const toAt = toDate(payload.toAt);
  const db = getDb();
  const toRows = (snap) => (snap && Array.isArray(snap.docs) ? snap.docs : [])
    .map((doc) => Object.assign({ id: doc.id }, doc.data()))
    .filter((row) => !excludeSyntheticPatrolReplay || !isSyntheticPatrolReplayRow(row))
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
      return (right ? right.getTime() : 0) - (left ? left.getTime() : 0);
    })
    .slice(0, limit);

  try {
    const orderedSnap = await db.collection(COLLECTION)
      .where('lineUserId', '==', lineUserId)
      .orderBy('createdAt', 'desc')
      .limit(queryLimit)
      .get();
    return toRows(orderedSnap);
  } catch (_err) {
    const fallbackSnap = await db.collection(COLLECTION)
      .where('lineUserId', '==', lineUserId)
      .get();
    return toRows(fallbackSnap);
  }
}

async function listLlmActionLogsByTraceId(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const traceId = normalizeString(payload.traceId, '');
  if (!traceId) return [];
  const limit = Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.min(300, Math.floor(Number(payload.limit)))) : 100;
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('traceId', '==', traceId).limit(limit).get();
  return snap.docs
    .map((doc) => Object.assign({ id: doc.id }, doc.data()))
    .sort((a, b) => {
      const left = toDate(a && a.createdAt);
      const right = toDate(b && b.createdAt);
      return (right ? right.getTime() : 0) - (left ? left.getTime() : 0);
    })
    .slice(0, limit);
}

async function getLlmActionLogByRequestId(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const requestId = normalizeString(payload.requestId, '');
  if (!requestId) return null;
  const limit = Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.min(20, Math.floor(Number(payload.limit)))) : 5;
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('requestId', '==', requestId).limit(limit).get();
  return snap.docs
    .map((doc) => Object.assign({ id: doc.id }, doc.data()))
    .sort((a, b) => {
      const left = toDate(a && (a.createdAt || a.updatedAt));
      const right = toDate(b && (b.createdAt || b.updatedAt));
      return (right ? right.getTime() : 0) - (left ? left.getTime() : 0);
    })[0] || null;
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
  listLlmActionLogsByTraceId,
  getLlmActionLogByRequestId,
  patchLlmActionLog,
  toDate,
  normalizeRewardSignals,
  isSyntheticPatrolReplayRow
};
