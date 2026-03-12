'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildQualityLoopV2Summary } = require('../../src/routes/admin/osLlmUsageSummary');

function buildBasePayload(actionRows) {
  return {
    conversationQuality: {
      sampleCount: 12,
      legacyTemplateHitRate: 0,
      defaultCasualRate: 0.01,
      contradictionRate: 0,
      avgSourceAuthorityScore: 0.9,
      avgSourceFreshnessScore: 0.9,
      conciseModeAppliedRate: 0.84,
      repetitionPreventedRate: 0.82,
      directAnswerAppliedRate: 0.86,
      clarifySuppressedRate: 0.83,
      avgContextCarryScore: 0.8,
      avgRepeatRiskScore: 0.14,
      followupQuestionIncludedRate: 0.73,
      followupResolutionRate: 0.78,
      followupCarryFromHistoryRate: 0.8,
      contextualResumeHandledRate: 0.81,
      recoverySignalRate: 0.72,
      misunderstandingRecoveredRate: 0.76,
      recoveryHandledRate: 0.77,
      domainIntentConciergeRate: 0.83,
      avgUnsupportedClaimCount: 0.03,
      officialOnlySatisfiedRate: 0.96,
      retrieveNeededRate: 0.12,
      verificationOutcomes: []
    },
    gateAuditBaseline: { acceptedRate: 0.96 },
    optimization: { compatShareWindow: 0.04 },
    releaseReadiness: { ready: true, metrics: { avgEvidenceCoverage: 0.9 } },
    byPlan: {
      free: { blockedRate: 0.1 },
      pro: { blockedRate: 0.02 }
    },
    actionRows,
    traceSearchAuditRows: []
  };
}

test('phase815: quality loop v2 summary reports soft enforcement stage from observed rows', () => {
  const quality = buildQualityLoopV2Summary(buildBasePayload([
    {
      answerReadinessVersion: 'v2',
      answerReadinessV2Stage: 'soft_enforcement',
      answerReadinessV2Mode: 'soft_enforced_v2',
      answerReadinessEnforcedV2: true,
      answerReadinessLogOnlyV2: false,
      readinessDecisionV2: 'clarify',
      cityPackGrounded: true,
      cityPackFreshnessScore: 0.92,
      cityPackAuthorityScore: 0.93,
      taskBlockerDetected: true,
      journeyAlignedAction: false,
      savedFaqReused: true,
      savedFaqReusePass: false,
      crossSystemConflictDetected: true,
      intentRiskTier: 'high',
      officialOnlySatisfied: true
    },
    {
      answerReadinessVersion: 'v2',
      answerReadinessV2Stage: 'log_only',
      answerReadinessV2Mode: 'log_only_v2',
      answerReadinessEnforcedV2: false,
      answerReadinessLogOnlyV2: true,
      readinessDecisionV2: 'allow',
      intentRiskTier: 'medium',
      officialOnlySatisfied: true
    }
  ]));

  assert.equal(quality.rolloutStage, 'soft_enforcement');
  assert.equal(quality.readinessV2.softEnforcedCount, 1);
  assert.equal(quality.readinessV2.logOnlyCount, 1);
  assert.ok(quality.readinessV2.modeBreakdown.some((row) => row.mode === 'soft_enforced_v2' && row.count === 1));
  assert.ok(quality.readinessV2.stageBreakdown.some((row) => row.stage === 'soft_enforcement' && row.count === 1));
});

test('phase815: quality loop v2 summary reports hard enforcement when webhook-style rows are enforced', () => {
  const quality = buildQualityLoopV2Summary(buildBasePayload([
    {
      answerReadinessVersion: 'v2',
      answerReadinessV2Stage: 'hard_enforcement',
      answerReadinessV2Mode: 'hard_enforced_v2',
      answerReadinessEnforcedV2: true,
      answerReadinessLogOnlyV2: false,
      readinessDecisionV2: 'refuse',
      emergencyContextActive: true,
      emergencyOfficialSourceSatisfied: true,
      intentRiskTier: 'high',
      officialOnlySatisfied: true
    }
  ]));

  assert.equal(quality.rolloutStage, 'hard_enforcement');
  assert.equal(quality.readinessV2.hardEnforcedCount, 1);
  assert.ok(quality.readinessV2.modeBreakdown.some((row) => row.mode === 'hard_enforced_v2' && row.count === 1));
  assert.ok(quality.readinessV2.stageBreakdown.some((row) => row.stage === 'hard_enforcement' && row.count === 1));
});

test('phase815: quality loop v2 summary reports no-go mandatory after hard enforcement rows are promoted', () => {
  const quality = buildQualityLoopV2Summary(buildBasePayload([
    {
      answerReadinessVersion: 'v2',
      answerReadinessV2Stage: 'nogo_gate_mandatory',
      answerReadinessV2Mode: 'hard_enforced_v2',
      answerReadinessEnforcedV2: true,
      answerReadinessLogOnlyV2: false,
      readinessDecisionV2: 'allow',
      emergencyContextActive: true,
      emergencyOfficialSourceSatisfied: true,
      intentRiskTier: 'high',
      officialOnlySatisfied: true
    }
  ]));

  assert.equal(quality.rolloutStage, 'nogo_gate_mandatory');
  assert.equal(quality.nogoGateMandatoryActive, true);
  assert.equal(quality.readinessV2.hardEnforcedCount, 1);
  assert.equal(quality.readinessV2.nogoGateMandatoryCount, 1);
  assert.ok(quality.readinessV2.stageBreakdown.some((row) => row.stage === 'nogo_gate_mandatory' && row.count === 1));
});
