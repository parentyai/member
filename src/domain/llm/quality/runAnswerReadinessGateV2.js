'use strict';

const { evaluateAnswerReadiness } = require('./evaluateAnswerReadiness');
const { buildAnswerReadinessContext } = require('./buildAnswerReadinessContext');
const { resolveAnswerReadinessV2Mode } = require('./resolveAnswerReadinessV2Mode');

function runAnswerReadinessGateV2(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const context = buildAnswerReadinessContext(payload);
  const readinessLegacy = evaluateAnswerReadiness(context.legacyInput);
  const readinessV2 = evaluateAnswerReadiness(context.v2Input);
  const mode = resolveAnswerReadinessV2Mode({
    entryType: payload.entryType,
    readinessLegacy,
    readinessV2
  }, payload.env);
  return {
    readiness: mode.enforceV2 === true ? readinessV2 : readinessLegacy,
    readinessLegacy,
    readinessV2,
    mode,
    answerReadinessVersion: 'v2',
    answerReadinessLogOnlyV2: mode.answerReadinessLogOnlyV2,
    answerReadinessEnforcedV2: mode.answerReadinessEnforcedV2,
    context,
    telemetry: {
      answerReadinessVersion: 'v2',
      answerReadinessEntryType: mode.entryType,
      answerReadinessV2Stage: mode.stage,
      answerReadinessV2Mode: mode.mode,
      answerReadinessV2EnforcementReason: mode.enforcementReason,
      answerReadinessEnforcedV2: mode.answerReadinessEnforcedV2,
      answerReadinessLogOnlyV2: mode.answerReadinessLogOnlyV2,
      readinessDecisionSource: readinessLegacy.decisionSource || null,
      readinessDecisionSourceV2: readinessV2.decisionSource || null,
      readinessHardeningVersion: readinessV2.qualitySnapshot && readinessV2.qualitySnapshot.readinessHardeningVersion
        ? readinessV2.qualitySnapshot.readinessHardeningVersion
        : null,
      readinessDecisionV2: readinessV2.decision,
      readinessReasonCodesV2: readinessV2.reasonCodes,
      readinessSafeResponseModeV2: readinessV2.safeResponseMode,
      emergencyContextActive: context.emergency.active,
      emergencySeverity: context.emergency.severity,
      emergencyOfficialSourceSatisfied: context.emergency.officialSourceSatisfied,
      emergencyOverrideApplied: context.emergency.overrideApplied,
      emergencyEventId: context.emergency.eventId,
      emergencyRegionKey: context.emergency.regionKey,
      emergencySourceSnapshot: context.emergency.sourceSnapshot,
      journeyPhase: context.journey.phase,
      taskBlockerDetected: context.journey.taskBlockerDetected,
      journeyAlignedAction: context.journey.journeyAlignedAction,
      blockedTask: context.journey.blockedTask,
      taskGraphState: context.journey.taskGraphState,
      nextActionCandidates: context.journey.nextActionCandidates,
      nextActions: context.journey.nextActions,
      cityPackContext: context.knowledge.cityPackContext,
      cityPackGrounded: context.knowledge.cityPackGrounded,
      cityPackGroundingReason: context.knowledge.cityPackGroundingReason,
      cityPackFreshnessScore: context.knowledge.cityPackFreshnessScore,
      cityPackAuthorityScore: context.knowledge.cityPackAuthorityScore,
      cityPackRequiredSourcesSatisfied: context.knowledge.cityPackRequiredSourcesSatisfied,
      cityPackSourceSnapshot: context.knowledge.cityPackSourceSnapshot,
      cityPackPackId: context.knowledge.cityPackPackId,
      requestedCityKey: context.knowledge.requestedCityKey || null,
      matchedCityKey: context.knowledge.matchedCityKey || null,
      citySpecificitySatisfied: context.knowledge.citySpecificitySatisfied === true,
      citySpecificityReason: context.knowledge.citySpecificityReason || null,
      scopeDisclosureRequired: context.knowledge.scopeDisclosureRequired === true,
      cityPackValidation: context.knowledge.cityPackValidation,
      savedFaqReused: context.knowledge.savedFaqReused,
      savedFaqReusePass: context.knowledge.savedFaqReusePass,
      savedFaqValid: context.knowledge.savedFaqValid,
      savedFaqAllowedIntent: context.knowledge.savedFaqAllowedIntent,
      savedFaqAuthorityScore: context.knowledge.savedFaqAuthorityScore,
      crossSystemConflictDetected: context.knowledge.crossSystemConflictDetected,
      sourceSnapshotRefs: context.knowledge.sourceSnapshotRefs,
      evidenceCoverageObserved: context.v2Input.evidenceCoverageObserved === true,
      officialOnlySatisfiedObserved: context.v2Input.officialOnlySatisfiedObserved === true,
      compatContextActive: context.v2Input.entryType === 'compat',
      policyTighteningVersion: readinessV2.qualitySnapshot && readinessV2.qualitySnapshot.policyTighteningVersion
        ? readinessV2.qualitySnapshot.policyTighteningVersion
        : null
    }
  };
}

module.exports = {
  runAnswerReadinessGateV2
};
