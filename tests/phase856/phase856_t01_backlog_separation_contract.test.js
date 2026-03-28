'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildDecayAwareReadiness
} = require('../../src/domain/qualityPatrol/buildDecayAwareReadiness');
const {
  buildDecayAwareOpsGate
} = require('../../src/domain/qualityPatrol/buildDecayAwareOpsGate');
const {
  buildPatrolBacklogSeparation
} = require('../../src/domain/qualityPatrol/query/buildPatrolBacklogSeparation');

function buildWindow(overrides) {
  return Object.assign({
    sourceWindow: {
      fromAt: '2026-03-15T12:00:00.000Z',
      toAt: '2026-03-15T13:00:00.000Z'
    },
    observedCount: 5,
    written: 5,
    skipped_unreviewable_transcript: 0,
    assistant_reply_missing: 0,
    reviewUnitCount: 5,
    faqOnlyRowsSkipped: 0,
    traceHydrationLimitedCount: 0,
    blockerCount: 0,
    blockerCodes: []
  }, overrides || {});
}

function buildSeparation(readinessOverrides) {
  const readiness = buildDecayAwareReadiness(Object.assign({
    recentWindow: buildWindow(),
    fullWindow: buildWindow(),
    previousFullWindow: buildWindow({
      sourceWindow: {
        fromAt: '2026-03-15T11:00:00.000Z',
        toAt: '2026-03-15T12:00:00.000Z'
      }
    })
  }, readinessOverrides || {}));
  const gate = buildDecayAwareOpsGate(readiness);
  return buildPatrolBacklogSeparation({
    audience: 'operator',
    decayAwareReadiness: readiness,
    decayAwareOpsGate: gate
  });
}

test('phase856: current runtime healthy and historical debt present stays separated and no-go', () => {
  const result = buildSeparation({
    fullWindow: buildWindow({
      observedCount: 60,
      written: 44,
      skipped_unreviewable_transcript: 16,
      assistant_reply_missing: 11,
      reviewUnitCount: 117,
      faqOnlyRowsSkipped: 100,
      traceHydrationLimitedCount: 67,
      blockerCount: 4
    }),
    previousFullWindow: buildWindow({
      sourceWindow: {
        fromAt: '2026-03-14T11:00:00.000Z',
        toAt: '2026-03-15T12:00:00.000Z'
      },
      observedCount: 55,
      written: 39,
      skipped_unreviewable_transcript: 16,
      assistant_reply_missing: 11,
      reviewUnitCount: 114,
      faqOnlyRowsSkipped: 100,
      traceHydrationLimitedCount: 67,
      blockerCount: 4
    })
  });

  assert.equal(result.currentRuntime.status, 'healthy');
  assert.equal(result.historicalDebt.status, 'stagnating');
  assert.equal(result.historicalDebt.debtCounts.skipped_unreviewable_transcript, 16);
  assert.equal(result.historicalDebt.debtCounts.assistant_reply_missing, 11);
  assert.equal(result.historicalDebt.debtCounts.faq_only_rows_skipped, 100);
  assert.equal(result.historicalDebt.debtCounts.action_trace_join_limited, 67);
  assert.equal(result.backlogSeparationGate.decision, 'NO_GO');
  assert.equal(result.backlogSeparationGate.reasonCode, 'historical_backlog_dominant');
  assert.equal(result.backlogSeparationGate.prDStatus, 'deferred');
});

test('phase856: current runtime healthy and historical debt cleared resolves go', () => {
  const result = buildSeparation();

  assert.equal(result.currentRuntime.status, 'healthy');
  assert.equal(result.historicalDebt.status, 'cleared');
  assert.equal(result.historicalDebt.totalDebtCount, 0);
  assert.equal(result.backlogSeparationGate.decision, 'GO');
  assert.equal(result.backlogSeparationGate.prDEligible, true);
  assert.equal(result.backlogSeparationGate.prDStatus, 'eligible');
});

test('phase856: current runtime unhealthy keeps runtime priority over debt state', () => {
  const result = buildSeparation({
    recentWindow: buildWindow({
      written: 3,
      skipped_unreviewable_transcript: 2,
      assistant_reply_missing: 1,
      blockerCount: 2
    }),
    fullWindow: buildWindow({
      observedCount: 60,
      written: 44,
      skipped_unreviewable_transcript: 16,
      assistant_reply_missing: 11,
      reviewUnitCount: 117,
      faqOnlyRowsSkipped: 100,
      traceHydrationLimitedCount: 67,
      blockerCount: 4
    })
  });

  assert.equal(result.currentRuntime.status, 'unhealthy');
  assert.equal(result.backlogSeparationGate.decision, 'NO_GO');
  assert.equal(result.backlogSeparationGate.reasonCode, 'current_runtime_or_current_join_problem');
  assert.equal(result.backlogSeparationGate.prDReasonCode, 'current_runtime_not_healthy');
});

test('phase856: observation-only blocker residue resolves observation continue instead of no-go', () => {
  const result = buildSeparation({
    recentWindow: buildWindow({
      blockerCount: 2,
      blockerCodes: ['missing_user_message', 'transcript_not_reviewable']
    }),
    fullWindow: buildWindow({
      observedCount: 97,
      written: 97,
      reviewUnitCount: 100,
      blockerCount: 5,
      blockerCodes: [
        'insufficient_knowledge_signals',
        'missing_assistant_reply',
        'missing_faq_evidence',
        'missing_user_message',
        'transcript_not_reviewable'
      ]
    }),
    previousFullWindow: buildWindow({
      sourceWindow: {
        fromAt: '2026-03-14T11:00:00.000Z',
        toAt: '2026-03-15T12:00:00.000Z'
      },
      observedCount: 1,
      written: 1,
      reviewUnitCount: 1,
      blockerCount: 0,
      blockerCodes: []
    })
  });

  assert.equal(result.currentRuntime.status, 'healthy');
  assert.equal(result.historicalDebt.status, 'decaying');
  assert.equal(result.historicalDebt.debtCounts.blocker_count, 3);
  assert.equal(result.backlogSeparationGate.decision, 'OBSERVATION_CONTINUE');
  assert.equal(result.backlogSeparationGate.reasonCode, 'observation_continue_backlog_decay');
  assert.equal(result.backlogSeparationGate.prDStatus, 'deferred');
});

test('phase856: sparse previous full window does not incorrectly resolve go', () => {
  const result = buildSeparation({
    fullWindow: buildWindow({
      observedCount: 60,
      written: 44,
      skipped_unreviewable_transcript: 16,
      assistant_reply_missing: 11,
      reviewUnitCount: 117,
      faqOnlyRowsSkipped: 100,
      traceHydrationLimitedCount: 67,
      blockerCount: 4
    }),
    previousFullWindow: buildWindow({
      sourceWindow: {
        fromAt: null,
        toAt: null
      },
      observedCount: 0,
      written: 0,
      skipped_unreviewable_transcript: 0,
      assistant_reply_missing: 0,
      reviewUnitCount: 0,
      faqOnlyRowsSkipped: 0,
      traceHydrationLimitedCount: 0,
      blockerCount: 0,
      blockerCodes: []
    })
  });

  assert.equal(result.historicalDebt.status, 'stagnating');
  assert.equal(result.backlogSeparationGate.decision, 'NO_GO');
  assert.equal(result.backlogSeparationGate.reasonCode, 'historical_backlog_dominant');
});

test('phase856: observation-only historical blockers stay visible without blocking go', () => {
  const result = buildSeparation({
    fullWindow: buildWindow({
      observedCount: 60,
      written: 60,
      reviewUnitCount: 117,
      blockerCount: 3,
      blockerCodes: [
        'missing_faq_evidence',
        'missing_user_message',
        'transcript_not_reviewable'
      ]
    }),
    previousFullWindow: buildWindow({
      sourceWindow: {
        fromAt: '2026-03-14T11:00:00.000Z',
        toAt: '2026-03-15T12:00:00.000Z'
      },
      observedCount: 55,
      written: 55,
      reviewUnitCount: 112,
      blockerCount: 0,
      blockerCodes: []
    })
  });

  assert.equal(result.currentRuntime.status, 'healthy');
  assert.equal(result.historicalDebt.status, 'cleared');
  assert.equal(result.historicalDebt.totalDebtCount, 0);
  assert.equal(result.historicalDebt.observationOnlyBlockerCount, 3);
  assert.equal(result.backlogSeparationGate.decision, 'GO');
  assert.equal(result.backlogSeparationGate.reasonCode, 'readiness_candidate');
  assert.equal(result.backlogSeparationGate.prDStatus, 'eligible');
});
