'use strict';

const ENTRY_TYPES = new Set(['webhook', 'admin', 'compat', 'job', 'unknown']);
const GATES = new Set(['kill_switch', 'injection', 'url_guard', 'policy', 'budget', 'availability', 'snapshot']);
const ALLOWED_SUMMARY_KEYS = new Set([
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
  'actionClass',
  'actionGatewayEnabled',
  'actionGatewayEnforced',
  'actionGatewayAllowed',
  'actionGatewayDecision',
  'actionGatewayReason',
  'domainIntent',
  'fallbackType',
  'interventionSuppressedBy',
  'responseContractConformant',
  'responseContractErrorCount',
  'responseContractErrors',
  'responseContractFallbackApplied'
]);

function resolveAppendAuditLog() {
  const loaded = require('../audit/appendAuditLog');
  if (loaded && typeof loaded.appendAuditLog === 'function') return loaded.appendAuditLog;
  throw new Error('appendAuditLog unavailable');
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeEntryType(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return 'unknown';
  return ENTRY_TYPES.has(normalized) ? normalized : 'unknown';
}

function normalizeGatesApplied(value) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item).toLowerCase();
    if (!normalized || !GATES.has(normalized)) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function normalizeAssistantQuality(value) {
  const payload = value && typeof value === 'object' ? value : {};
  return {
    intentResolved: normalizeText(payload.intentResolved) || null,
    kbTopScore: Number.isFinite(Number(payload.kbTopScore)) ? Number(payload.kbTopScore) : 0,
    evidenceCoverage: Number.isFinite(Number(payload.evidenceCoverage)) ? Number(payload.evidenceCoverage) : 0,
    blockedStage: normalizeText(payload.blockedStage) || null,
    fallbackReason: normalizeText(payload.fallbackReason) || null
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeSummaryInput(value) {
  const payload = isObject(value) ? value : {};
  const out = {};
  Object.keys(payload).forEach((key) => {
    if (!ALLOWED_SUMMARY_KEYS.has(key)) return;
    out[key] = payload[key];
  });
  return out;
}

async function appendLlmGateDecision(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const auditFn = deps && typeof deps.appendAuditLog === 'function' ? deps.appendAuditLog : resolveAppendAuditLog();
  const summaryFromInput = sanitizeSummaryInput(payload.payloadSummary);
  const gatesApplied = normalizeGatesApplied(
    summaryFromInput.gatesApplied !== undefined ? summaryFromInput.gatesApplied : payload.gatesApplied
  );
  const entryType = normalizeEntryType(
    summaryFromInput.entryType !== undefined ? summaryFromInput.entryType : payload.entryType
  );
  const assistantQuality = summaryFromInput.assistantQuality !== undefined
    ? normalizeAssistantQuality(summaryFromInput.assistantQuality)
    : normalizeAssistantQuality(payload.assistantQuality);
  const sanitizeApplied = summaryFromInput.sanitizeApplied === true || payload.sanitizeApplied === true;
  const sanitizedCandidateCount = Number.isFinite(Number(summaryFromInput.sanitizedCandidateCount))
    ? Number(summaryFromInput.sanitizedCandidateCount)
    : (Number.isFinite(Number(payload.sanitizedCandidateCount)) ? Number(payload.sanitizedCandidateCount) : 0);

  const summary = Object.assign(summaryFromInput, {
    lineUserId: summaryFromInput.lineUserId || payload.lineUserId || null,
    plan: summaryFromInput.plan || payload.plan || 'unknown',
    status: summaryFromInput.status || payload.status || 'unknown',
    intent: summaryFromInput.intent || payload.intent || 'unknown',
    decision: summaryFromInput.decision || payload.decision || 'blocked',
    blockedReason: summaryFromInput.blockedReason || payload.blockedReason || null,
    tokenUsed: Number.isFinite(Number(summaryFromInput.tokenUsed))
      ? Number(summaryFromInput.tokenUsed)
      : (Number.isFinite(Number(payload.tokenUsed)) ? Number(payload.tokenUsed) : 0),
    costEstimate: Number.isFinite(Number(summaryFromInput.costEstimate))
      ? Number(summaryFromInput.costEstimate)
      : (Number.isFinite(Number(payload.costEstimate)) ? Number(payload.costEstimate) : null),
    model: summaryFromInput.model || payload.model || null,
    entryType,
    gatesApplied,
    assistantQuality,
    sanitizeApplied,
    sanitizedCandidateCount
  });

  await auditFn({
    actor: payload.actor || 'unknown',
    action: 'llm_gate.decision',
    entityType: payload.entityType || 'llm_gate',
    entityId: payload.entityId || summary.lineUserId || entryType,
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: summary
  });
}

module.exports = {
  appendLlmGateDecision,
  sanitizeSummaryInput,
  normalizeEntryType,
  normalizeGatesApplied
};
