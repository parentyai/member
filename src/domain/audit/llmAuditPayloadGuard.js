'use strict';

const TOP_LEVEL_KEYS = new Set([
  'actor',
  'action',
  'entityType',
  'entityId',
  'traceId',
  'requestId',
  'lineUserId',
  'eventType',
  'payloadSummary',
  'createdAt'
]);

const BLOCKED_PAYLOAD_SUMMARY_KEYS = new Set([
  'fullReplyText',
  'rawPrompt',
  'rawKbBodies',
  'fullRequestBody'
]);

const LLM_GATE_KEYS = new Set([
  'lineUserId',
  'plan',
  'status',
  'intent',
  'decision',
  'blockedReason',
  'tokenUsed',
  'costEstimate',
  'model',
  'policyVersionId',
  'refusalMode',
  'userTier',
  'mode',
  'topic',
  'citationRanks',
  'urlCount',
  'urls',
  'guardDecisions',
  'blockedReasons',
  'injectionFindings',
  'conversationState',
  'conversationMove',
  'styleId',
  'conversationPattern',
  'responseLength',
  'intentConfidence',
  'contextConfidence',
  'evidenceNeed',
  'evidenceOutcome',
  'chosenAction',
  'contextVersion',
  'featureHash',
  'postRenderLint',
  'contextSignature',
  'contextualBanditEnabled',
  'contextualFeatures',
  'counterfactualSelectedArmId',
  'counterfactualSelectedRank',
  'counterfactualTopArms',
  'counterfactualEval',
  'assistantQuality',
  'entryType',
  'gatesApplied',
  'conversationMode',
  'routerReason',
  'opportunityType',
  'opportunityReasonKeys',
  'interventionBudget',
  'sanitizeApplied',
  'sanitizedCandidateCount',
  'lawfulBasis',
  'consentVerified',
  'crossBorder',
  'policySource',
  'policyContext',
  'legalDecision',
  'legalReasonCodes',
  'intentRiskTier',
  'riskReasonCodes',
  'sourceAuthorityScore',
  'sourceFreshnessScore',
  'sourceReadinessDecision',
  'sourceReadinessReasons',
  'officialOnlySatisfied',
  'readinessDecision',
  'readinessReasonCodes',
  'readinessSafeResponseMode',
  'answerReadinessVersion',
  'answerReadinessLogOnlyV2',
  'answerReadinessEnforcedV2',
  'answerReadinessV2Mode',
  'answerReadinessV2Stage',
  'answerReadinessV2EnforcementReason',
  'readinessDecisionV2',
  'readinessReasonCodesV2',
  'readinessSafeResponseModeV2',
  'emergencyContextActive',
  'emergencyOfficialSourceSatisfied',
  'journeyPhase',
  'taskBlockerDetected',
  'journeyAlignedAction',
  'cityPackGrounded',
  'cityPackFreshnessScore',
  'cityPackAuthorityScore',
  'savedFaqValid',
  'savedFaqAllowedIntent',
  'savedFaqAuthorityScore',
  'crossSystemConflictDetected',
  'unsupportedClaimCount',
  'contradictionDetected',
  'answerReadinessLogOnly',
  'orchestratorPathUsed',
  'contextResumeDomain',
  'loopBreakApplied',
  'followupIntent',
  'conciseModeApplied',
  'repetitionPrevented',
  'directAnswerApplied',
  'clarifySuppressed',
  'misunderstandingRecovered',
  'contextCarryScore',
  'repeatRiskScore',
  'legacyTemplateHit',
  'followupQuestionIncluded',
  'actionCount',
  'pitfallIncluded',
  'domainIntent',
  'fallbackType',
  'interventionSuppressedBy',
  'savedFaqReused',
  'savedFaqReusePass',
  'savedFaqReuseReasonCodes',
  'sourceSnapshotRefs'
]);

const LLM_USAGE_KEYS = new Set([
  'windowDays',
  'callsTotal',
  'blockedRate',
  'releaseReady',
  'releaseBlockedBy',
  'optimizationVersion',
  'compatShareWindow',
  'scanLimit',
  'topUserCount',
  'rowCount',
  'piiMasked'
]);

const LLM_QUALITY_KEYS = new Set([
  'intent',
  'decision',
  'blockedReason',
  'top1Score',
  'top2Score',
  'citationCount',
  'retryCount',
  'model',
  'windowDays',
  'scanLimit',
  'rowCount',
  'qualityVersion'
]);

const LLM_ACTION_KEYS = new Set([
  'dryRun',
  'processed',
  'updated',
  'skipped',
  'errors',
  'rewardWindowHours',
  'counterfactualEvaluated',
  'counterfactualOpportunityDetected',
  'optimizationVersion',
  'rewardVersion',
  'windowDays',
  'scanLimit',
  'rowCount'
]);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function isTargetLlmAction(action) {
  const normalized = normalizeText(action);
  if (!normalized) return false;
  return (
    normalized === 'llm_gate.decision'
    || normalized.startsWith('llm_usage.')
    || normalized.startsWith('llm_quality.')
    || normalized.startsWith('llm_action.')
  );
}

function resolvePayloadAllowlist(action) {
  const normalized = normalizeText(action);
  if (normalized === 'llm_gate.decision') return LLM_GATE_KEYS;
  if (normalized.startsWith('llm_usage.')) return LLM_USAGE_KEYS;
  if (normalized.startsWith('llm_quality.')) return LLM_QUALITY_KEYS;
  if (normalized.startsWith('llm_action.')) return LLM_ACTION_KEYS;
  return null;
}

function sanitizeObject(source, allowlist, dropped, prefix) {
  const payload = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const out = {};
  Object.keys(payload).forEach((key) => {
    if (!allowlist.has(key) || BLOCKED_PAYLOAD_SUMMARY_KEYS.has(key)) {
      dropped.push(`${prefix}.${key}`);
      return;
    }
    out[key] = payload[key];
  });
  return out;
}

function sanitizeLlmAuditPayload(entry) {
  const payload = entry && typeof entry === 'object' ? entry : {};
  const action = normalizeText(payload.action);
  if (!isTargetLlmAction(action)) {
    return Object.assign({}, payload);
  }

  const dropped = [];
  const sanitized = sanitizeObject(payload, TOP_LEVEL_KEYS, dropped, 'root');
  if (!sanitized.action) sanitized.action = action;

  const payloadSummary = payload.payloadSummary && typeof payload.payloadSummary === 'object'
    ? payload.payloadSummary
    : {};
  const allowlist = resolvePayloadAllowlist(action);
  const sanitizedSummary = allowlist
    ? sanitizeObject(payloadSummary, allowlist, dropped, 'payloadSummary')
    : {};

  if (dropped.length > 0) {
    sanitizedSummary._droppedKeyCount = dropped.length;
    sanitizedSummary._droppedKeysSample = Array.from(new Set(dropped)).slice(0, 3);
  }

  sanitized.payloadSummary = sanitizedSummary;
  return sanitized;
}

module.exports = {
  sanitizeLlmAuditPayload,
  isTargetLlmAction,
  resolvePayloadAllowlist
};
