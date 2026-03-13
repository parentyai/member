'use strict';

const { resolveEmergencyQualityContext } = require('./resolveEmergencyQualityContext');
const { resolveJourneyQualityContext } = require('./resolveJourneyQualityContext');
const { resolveKnowledgeIntegrationContext } = require('./resolveKnowledgeIntegrationContext');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeReasonCodes(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item).toLowerCase().replace(/\s+/g, '_');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, 16);
}

function buildLegacyInput(payload) {
  return {
    entryType: payload.entryType,
    lawfulBasis: payload.lawfulBasis,
    consentVerified: payload.consentVerified,
    crossBorder: payload.crossBorder,
    legalDecision: payload.legalDecision,
    intentRiskTier: payload.intentRiskTier,
    sourceAuthorityScore: payload.sourceAuthorityScore,
    sourceFreshnessScore: payload.sourceFreshnessScore,
    sourceReadinessDecision: payload.sourceReadinessDecision,
    officialOnlySatisfied: payload.officialOnlySatisfied,
    officialOnlySatisfiedObserved: payload.officialOnlySatisfiedObserved,
    unsupportedClaimCount: payload.unsupportedClaimCount,
    contradictionDetected: payload.contradictionDetected,
    requiredCoreFactsComplete: payload.requiredCoreFactsComplete,
    missingRequiredCoreFactsCount: payload.missingRequiredCoreFactsCount,
    requiredCoreFactsMissing: payload.requiredCoreFactsMissing,
    requiredCoreFactsDecision: payload.requiredCoreFactsDecision,
    requiredCoreFactsLogOnly: payload.requiredCoreFactsLogOnly,
    evidenceCoverage: payload.evidenceCoverage,
    evidenceCoverageObserved: payload.evidenceCoverageObserved,
    fallbackType: payload.fallbackType || null,
    reasonCodes: normalizeReasonCodes(payload.reasonCodes)
  };
}

function buildAnswerReadinessContext(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const emergency = resolveEmergencyQualityContext(payload);
  const journey = resolveJourneyQualityContext(payload);
  const knowledge = resolveKnowledgeIntegrationContext(payload);
  const legacyInput = buildLegacyInput(payload);
  const v2ReasonCodes = normalizeReasonCodes([].concat(
    legacyInput.reasonCodes || [],
    emergency.reasonCodes || [],
    journey.reasonCodes || [],
    knowledge.reasonCodes || []
  ));
  const v2Input = Object.assign({}, legacyInput, {
    emergencyContextActive: emergency.active,
    emergencySeverity: emergency.severity,
    emergencyOfficialSourceSatisfied: emergency.officialSourceSatisfied,
    emergencyOverrideApplied: emergency.overrideApplied,
    emergencyEventId: emergency.eventId,
    emergencyRegionKey: emergency.regionKey,
    emergencySourceSnapshot: emergency.sourceSnapshot,
    journeyContextActive: journey.active,
    journeyPhase: journey.phase,
    taskBlockerDetected: journey.taskBlockerDetected,
    journeyAlignedAction: journey.journeyAlignedAction,
    blockedTask: journey.blockedTask,
    taskGraphState: journey.taskGraphState,
    nextActionCandidates: journey.nextActionCandidates,
    nextActions: journey.nextActions,
    cityPackContext: knowledge.cityPackContext,
    cityPackGrounded: knowledge.cityPackGrounded,
    cityPackGroundingReason: knowledge.cityPackGroundingReason,
    cityPackFreshnessScore: knowledge.cityPackFreshnessScore,
    cityPackAuthorityScore: knowledge.cityPackAuthorityScore,
    cityPackRequiredSourcesSatisfied: knowledge.cityPackRequiredSourcesSatisfied,
    cityPackSourceSnapshot: knowledge.cityPackSourceSnapshot,
    cityPackPackId: knowledge.cityPackPackId,
    cityPackValidation: knowledge.cityPackValidation,
    savedFaqReused: knowledge.savedFaqReused,
    savedFaqReusePass: knowledge.savedFaqReusePass,
    savedFaqValid: knowledge.savedFaqValid,
    savedFaqAllowedIntent: knowledge.savedFaqAllowedIntent,
    savedFaqAuthorityScore: knowledge.savedFaqAuthorityScore,
    crossSystemConflictDetected: knowledge.crossSystemConflictDetected,
    reasonCodes: v2ReasonCodes
  });
  return {
    legacyInput,
    v2Input,
    emergency,
    journey,
    knowledge
  };
}

module.exports = {
  buildAnswerReadinessContext
};
