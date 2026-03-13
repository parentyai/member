'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveJourneyQualityContext } = require('../../src/domain/llm/quality/resolveJourneyQualityContext');
const { runAnswerReadinessGateV2 } = require('../../src/domain/llm/quality/runAnswerReadinessGateV2');

test('phase831: journey blocker context is preserved and reflected in readiness decision', () => {
  const journeyContext = resolveJourneyQualityContext({
    journeyContext: true,
    journeyPhase: 'housing',
    taskBlockerDetected: true,
    journeyAlignedAction: false,
    blockedTask: { key: 'lease-signature', status: 'blocked' },
    nextActions: ['schedule landlord call'],
    nextActionCandidates: ['schedule landlord call'],
    taskGraphState: { taskCount: 3, blockedTaskKey: 'lease-signature' }
  });

  assert.equal(journeyContext.taskBlockerDetected, true);
  assert.equal(journeyContext.journeyAlignedAction, false);
  assert.equal(journeyContext.nextActionCandidates[0], 'schedule landlord call');

  const result = runAnswerReadinessGateV2({
    entryType: 'webhook',
    lawfulBasis: 'consent',
    consentVerified: true,
    legalDecision: 'allow',
    intentRiskTier: 'medium',
    sourceAuthorityScore: 0.9,
    sourceFreshnessScore: 0.92,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    officialOnlySatisfiedObserved: true,
    evidenceCoverage: 0.92,
    evidenceCoverageObserved: true,
    journeyContext: true,
    journeyPhase: journeyContext.phase,
    taskBlockerDetected: journeyContext.taskBlockerDetected,
    journeyAlignedAction: journeyContext.journeyAlignedAction,
    blockedTask: journeyContext.blockedTask,
    taskGraphState: journeyContext.taskGraphState,
    nextActionCandidates: journeyContext.nextActionCandidates,
    nextActions: journeyContext.nextActions
  });

  assert.equal(result.readinessV2.decision, 'clarify');
  assert.ok(result.readinessV2.reasonCodes.includes('journey_task_conflict'));
  assert.equal(result.telemetry.taskBlockerDetected, true);
  assert.equal(result.telemetry.journeyAlignedAction, false);
  assert.deepEqual(result.telemetry.blockedTask, { key: 'lease-signature', status: 'blocked' });
});
