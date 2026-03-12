'use strict';

const { evaluateAnswerReadiness } = require('./evaluateAnswerReadiness');
const { buildAnswerReadinessContext } = require('./buildAnswerReadinessContext');

function runAnswerReadinessGateV2(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const context = buildAnswerReadinessContext(payload);
  const readinessLegacy = evaluateAnswerReadiness(context.legacyInput);
  const readinessV2 = evaluateAnswerReadiness(context.v2Input);
  const enforceV2 = payload.enforceV2 === true;
  return {
    readiness: enforceV2 ? readinessV2 : readinessLegacy,
    readinessLegacy,
    readinessV2,
    answerReadinessVersion: 'v2',
    answerReadinessLogOnlyV2: enforceV2 !== true,
    answerReadinessEnforcedV2: enforceV2 === true,
    context,
    telemetry: {
      answerReadinessVersion: 'v2',
      readinessDecisionV2: readinessV2.decision,
      readinessReasonCodesV2: readinessV2.reasonCodes,
      readinessSafeResponseModeV2: readinessV2.safeResponseMode,
      emergencyContextActive: context.emergency.active,
      emergencySeverity: context.emergency.severity,
      emergencyOfficialSourceSatisfied: context.emergency.officialSourceSatisfied,
      journeyPhase: context.journey.phase,
      taskBlockerDetected: context.journey.taskBlockerDetected,
      journeyAlignedAction: context.journey.journeyAlignedAction,
      cityPackGrounded: context.knowledge.cityPackGrounded,
      cityPackFreshnessScore: context.knowledge.cityPackFreshnessScore,
      cityPackAuthorityScore: context.knowledge.cityPackAuthorityScore,
      savedFaqReused: context.knowledge.savedFaqReused,
      savedFaqReusePass: context.knowledge.savedFaqReusePass,
      savedFaqValid: context.knowledge.savedFaqValid,
      savedFaqAllowedIntent: context.knowledge.savedFaqAllowedIntent,
      savedFaqAuthorityScore: context.knowledge.savedFaqAuthorityScore,
      crossSystemConflictDetected: context.knowledge.crossSystemConflictDetected,
      sourceSnapshotRefs: context.knowledge.sourceSnapshotRefs
    }
  };
}

module.exports = {
  runAnswerReadinessGateV2
};
