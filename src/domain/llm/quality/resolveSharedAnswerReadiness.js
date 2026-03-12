'use strict';

const { runAnswerReadinessGateV2 } = require('./runAnswerReadinessGateV2');
const { applyAnswerReadinessDecision } = require('./applyAnswerReadinessDecision');
const { resolveIntentRiskTier } = require('../policy/resolveIntentRiskTier');
const { enforceActionGateway } = require('../../../v1/action_gateway/actionGateway');
const { resolveActionClass } = require('../../../v1/policy_graph/resolveActionClass');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeDecision(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'allow' || normalized === 'hedged' || normalized === 'clarify' || normalized === 'refuse') {
    return normalized;
  }
  return null;
}

function normalizeReasonCodes(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((row) => {
    const normalized = normalizeText(row).toLowerCase().replace(/\s+/g, '_');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, 12);
}

function normalizeScore(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function applyActionGatewayToReadiness(readiness, actionGateway) {
  const base = readiness && typeof readiness === 'object'
    ? readiness
    : { decision: 'allow', reasonCodes: [], safeResponseMode: 'answer', qualitySnapshot: {} };
  if (!actionGateway || actionGateway.enabled !== true) return base;
  if (actionGateway.allowed === true) return base;
  const reasonCodes = normalizeReasonCodes([].concat(base.reasonCodes || [], actionGateway.reason || []));
  if (actionGateway.decision === 'clarify') {
    return Object.assign({}, base, {
      decision: 'clarify',
      reasonCodes,
      safeResponseMode: 'clarify'
    });
  }
  return Object.assign({}, base, {
    decision: 'refuse',
    reasonCodes,
    safeResponseMode: 'refuse'
  });
}

function resolveSharedAnswerReadiness(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const domainIntent = normalizeText(payload.domainIntent).toLowerCase() || 'general';
  const risk = resolveIntentRiskTier({
    domainIntent,
    emergencyContext: payload.emergencyContext === true,
    taskBlockerContext: payload.taskBlockerContext === true || payload.taskBlockerDetected === true,
    journeyContext: payload.journeyContext === true,
    cityPackContext: payload.cityPackContext === true,
    savedFaqContext: payload.savedFaqContext === true || payload.savedFaqReused === true,
    reasonCodes: payload.riskReasonCodes
  });
  const llmUsed = payload.llmUsed === true;

  const explicitDecision = normalizeDecision(payload.readinessDecision);
  const explicitReasonCodes = normalizeReasonCodes(payload.readinessReasonCodes);
  const explicitSafeResponseMode = normalizeText(payload.readinessSafeResponseMode).toLowerCase() || null;

  const evaluatedGate = runAnswerReadinessGateV2({
    entryType: normalizeText(payload.entryType) || 'admin',
    lawfulBasis: normalizeText(payload.lawfulBasis) || 'consent',
    consentVerified: payload.consentVerified !== false,
    crossBorder: payload.crossBorder === true,
    legalDecision: normalizeText(payload.legalDecision) || 'allow',
    intentRiskTier: risk.intentRiskTier,
    sourceAuthorityScore: normalizeScore(payload.sourceAuthorityScore, llmUsed ? 0.72 : 0.55),
    sourceFreshnessScore: normalizeScore(payload.sourceFreshnessScore, llmUsed ? 0.72 : 0.55),
    sourceReadinessDecision: normalizeText(payload.sourceReadinessDecision) || (llmUsed ? 'allow' : 'clarify'),
    officialOnlySatisfied: payload.officialOnlySatisfied !== false,
    unsupportedClaimCount: Number.isFinite(Number(payload.unsupportedClaimCount))
      ? Number(payload.unsupportedClaimCount)
      : 0,
    contradictionDetected: payload.contradictionDetected === true,
    evidenceCoverage: normalizeScore(payload.evidenceCoverage, llmUsed ? 0.7 : 0.5),
    fallbackType: normalizeText(payload.fallbackType) || null,
    reasonCodes: normalizeReasonCodes([].concat(risk.riskReasonCodes || [], explicitReasonCodes)),
    emergencyContext: payload.emergencyContext === true,
    emergencySeverity: payload.emergencySeverity || null,
    emergencyOfficialSourceSatisfied: payload.emergencyOfficialSourceSatisfied === true,
    journeyContext: payload.journeyContext === true,
    journeyPhase: payload.journeyPhase || null,
    taskBlockerDetected: payload.taskBlockerDetected === true,
    taskBlockerContext: payload.taskBlockerContext === true,
    journeyAlignedAction: typeof payload.journeyAlignedAction === 'boolean' ? payload.journeyAlignedAction : true,
    cityPackContext: payload.cityPackContext === true,
    cityPackGrounded: payload.cityPackGrounded === true,
    cityPackFreshnessScore: payload.cityPackFreshnessScore,
    cityPackAuthorityScore: payload.cityPackAuthorityScore,
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
  const evaluated = evaluatedGate.readiness;

  const actionClass = resolveActionClass(normalizeText(payload.actionClass) || 'lookup');
  const actionGatewayEnabled = normalizeBoolean(payload.actionGatewayEnabled, false);
  const actionGatewayDecision = enforceActionGateway({
    actionClass,
    toolName: normalizeText(payload.toolName) || (actionClass === 'draft' ? 'draft' : 'lookup'),
    confirmationToken: normalizeText(payload.confirmationToken)
  });
  const actionGateway = {
    enabled: actionGatewayEnabled,
    actionClass,
    decision: actionGatewayEnabled ? actionGatewayDecision.decision : 'bypass',
    reason: actionGatewayEnabled ? actionGatewayDecision.reason : 'action_gateway_disabled',
    allowed: actionGatewayEnabled ? actionGatewayDecision.allowed === true : true,
    enforced: actionGatewayEnabled
  };

  const readinessRaw = explicitDecision
    ? {
      decision: explicitDecision,
      reasonCodes: explicitReasonCodes.length ? explicitReasonCodes : evaluated.reasonCodes,
      safeResponseMode: explicitSafeResponseMode || evaluated.safeResponseMode,
      qualitySnapshot: evaluated.qualitySnapshot
    }
    : evaluated;
  const readiness = applyActionGatewayToReadiness(readinessRaw, actionGateway);

  const applied = applyAnswerReadinessDecision({
    decision: readiness.decision,
    replyText: payload.replyText,
    clarifyText: payload.clarifyText,
    refuseText: payload.refuseText
  });

  return {
    readiness,
    readinessV2: evaluatedGate.readinessV2,
    domainIntent: risk.domainIntent,
    intentRiskTier: risk.intentRiskTier,
    replyText: applied.replyText,
    readinessEnforced: applied.enforced === true,
    actionGateway,
    answerReadinessVersion: evaluatedGate.answerReadinessVersion,
    answerReadinessLogOnlyV2: evaluatedGate.answerReadinessLogOnlyV2,
    answerReadinessEnforcedV2: evaluatedGate.answerReadinessEnforcedV2,
    answerReadinessV2Mode: evaluatedGate.mode ? evaluatedGate.mode.mode : 'log_only_v2',
    answerReadinessV2Stage: evaluatedGate.mode ? evaluatedGate.mode.stage : 'log_only',
    answerReadinessV2EnforcementReason: evaluatedGate.mode ? evaluatedGate.mode.enforcementReason : 'log_only_default',
    readinessTelemetryV2: evaluatedGate.telemetry
  };
}

module.exports = {
  resolveSharedAnswerReadiness
};
