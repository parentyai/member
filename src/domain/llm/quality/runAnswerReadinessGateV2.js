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
