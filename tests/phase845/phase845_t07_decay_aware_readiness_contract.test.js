'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildDecayAwareReadiness
} = require('../../src/domain/qualityPatrol/buildDecayAwareReadiness');

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

test('phase845: recent healthy and full unhealthy resolves historical backlog dominant', () => {
  const result = buildDecayAwareReadiness({
    recentWindow: buildWindow(),
    fullWindow: buildWindow({
      observedCount: 60,
      written: 44,
      skipped_unreviewable_transcript: 16,
      assistant_reply_missing: 11,
      reviewUnitCount: 117,
      faqOnlyRowsSkipped: 100,
      traceHydrationLimitedCount: 67,
      blockerCount: 4,
      blockerCodes: [
        'observation_gap',
        'transcript_write_coverage_missing',
        'action_trace_join_limited',
        'insufficient_runtime_evidence'
      ]
    }),
    previousFullWindow: buildWindow({
      sourceWindow: {
        fromAt: '2026-03-15T11:00:00.000Z',
        toAt: '2026-03-15T12:00:00.000Z'
      },
      observedCount: 55,
      written: 39,
      skipped_unreviewable_transcript: 16,
      assistant_reply_missing: 11,
      reviewUnitCount: 114,
      faqOnlyRowsSkipped: 100,
      traceHydrationLimitedCount: 67,
      blockerCount: 4,
      blockerCodes: [
        'observation_gap',
        'transcript_write_coverage_missing',
        'action_trace_join_limited',
        'insufficient_runtime_evidence'
      ]
    })
  });

  assert.equal(result.recentWindowStatus, 'healthy');
  assert.equal(result.historicalBacklogStatus, 'stagnating');
  assert.equal(result.overallReadinessStatus, 'historical_backlog_dominant');
  assert.equal(result.historicalDebt.status, 'present');
  assert.equal(result.deltaFromPreviousFullWindow.status, 'stagnating');
});

test('phase845: recent unhealthy resolves current runtime or current join problem', () => {
  const result = buildDecayAwareReadiness({
    recentWindow: buildWindow({
      written: 3,
      skipped_unreviewable_transcript: 2,
      assistant_reply_missing: 1,
      blockerCount: 2,
      blockerCodes: ['observation_gap', 'transcript_write_coverage_missing']
    }),
    fullWindow: buildWindow({
      observedCount: 60,
      written: 44,
      skipped_unreviewable_transcript: 16,
      assistant_reply_missing: 11,
      reviewUnitCount: 117,
      blockerCount: 4,
      blockerCodes: [
        'observation_gap',
        'transcript_write_coverage_missing',
        'action_trace_join_limited',
        'insufficient_runtime_evidence'
      ]
    }),
    previousFullWindow: buildWindow({
      sourceWindow: {
        fromAt: '2026-03-15T11:00:00.000Z',
        toAt: '2026-03-15T12:00:00.000Z'
      },
      observedCount: 55,
      written: 39,
      skipped_unreviewable_transcript: 16,
      assistant_reply_missing: 11,
      reviewUnitCount: 114,
      blockerCount: 4
    })
  });

  assert.equal(result.recentWindowStatus, 'unhealthy');
  assert.equal(result.historicalBacklogStatus, 'current_runtime_overlap');
  assert.equal(result.overallReadinessStatus, 'current_runtime_or_current_join_problem');
});

test('phase845: backlog decay is separated from stagnation', () => {
  const result = buildDecayAwareReadiness({
    recentWindow: buildWindow(),
    fullWindow: buildWindow({
      observedCount: 60,
      written: 48,
      skipped_unreviewable_transcript: 14,
      assistant_reply_missing: 9,
      reviewUnitCount: 117,
      faqOnlyRowsSkipped: 95,
      traceHydrationLimitedCount: 58,
      blockerCount: 3,
      blockerCodes: [
        'observation_gap',
        'transcript_write_coverage_missing',
        'insufficient_runtime_evidence'
      ]
    }),
    previousFullWindow: buildWindow({
      sourceWindow: {
        fromAt: '2026-03-15T11:00:00.000Z',
        toAt: '2026-03-15T12:00:00.000Z'
      },
      observedCount: 55,
      written: 39,
      skipped_unreviewable_transcript: 16,
      assistant_reply_missing: 11,
      reviewUnitCount: 114,
      faqOnlyRowsSkipped: 100,
      traceHydrationLimitedCount: 64,
      blockerCount: 4,
      blockerCodes: [
        'observation_gap',
        'transcript_write_coverage_missing',
        'action_trace_join_limited',
        'insufficient_runtime_evidence'
      ]
    })
  });

  assert.equal(result.historicalBacklogStatus, 'decaying');
  assert.equal(result.overallReadinessStatus, 'observation_continue_backlog_decay');
  assert.equal(result.deltaFromPreviousFullWindow.status, 'improving');
});
