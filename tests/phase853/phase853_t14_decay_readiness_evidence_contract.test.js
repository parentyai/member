'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildPatrolQueryResponse } = require('../../src/domain/qualityPatrol/query/buildPatrolQueryResponse');

function buildDecayAwareReadiness() {
  return {
    recentWindowStatus: 'healthy',
    historicalBacklogStatus: 'stagnating',
    overallReadinessStatus: 'historical_backlog_dominant',
    recentWindow: {
      sourceWindow: { fromAt: '2026-03-15T12:00:00.000Z', toAt: '2026-03-15T13:00:00.000Z' },
      observedCount: 5,
      written: 5,
      skipped_unreviewable_transcript: 0,
      assistant_reply_missing: 0,
      reviewUnitCount: 5,
      faqOnlyRowsSkipped: 0,
      traceHydrationLimitedCount: 0,
      blockerCount: 0,
      blockerCodes: []
    },
    fullWindow: {
      sourceWindow: { fromAt: '2026-03-14T12:00:00.000Z', toAt: '2026-03-15T13:00:00.000Z' },
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
    },
    previousFullWindow: {
      sourceWindow: { fromAt: '2026-03-13T11:00:00.000Z', toAt: '2026-03-14T12:00:00.000Z' },
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
    },
    deltaFromPreviousFullWindow: {
      available: true,
      status: 'stagnating',
      observedCount: 5,
      written: 5,
      skipped_unreviewable_transcript: 0,
      assistant_reply_missing: 0,
      reviewUnitCount: 3,
      faqOnlyRowsSkipped: 0,
      traceHydrationLimitedCount: 3,
      blockerCount: 0
    },
    historicalDebt: {
      status: 'present',
      trend: 'stagnating',
      transcriptDebtCount: 27,
      joinDebtCount: 167,
      dominantDebt: 'join_limit',
      blockerCount: 4
    },
    currentRuntimeHealth: {
      status: 'healthy',
      observedCount: 5,
      reviewUnitCount: 5,
      transcriptWriteCoverageHealthy: true,
      joinHealthy: true
    }
  };
}

test('phase853: operator sees decay-aware readiness facts while human stays compressed', () => {
  const operator = buildPatrolQueryResponse({
    audience: 'operator',
    mode: 'latest',
    reviewUnits: [{ reviewUnitId: 'ru', slice: 'other', evidenceRefs: [], sourceCollections: ['llm_action_logs'] }],
    evaluations: [],
    metrics: {},
    transcriptCoverage: { observedCount: 60, transcriptWriteOutcomeCounts: { written: 44 }, transcriptCoverageStatus: 'ready' },
    decayAwareReadiness: buildDecayAwareReadiness(),
    kpiSummary: { overallStatus: 'warn' },
    issues: [],
    rootCauseReports: [],
    recommendedPr: [],
    planningStatus: 'blocked',
    sourceCollections: ['llm_action_logs']
  });
  const human = buildPatrolQueryResponse({
    audience: 'human',
    mode: 'latest',
    reviewUnits: [{ reviewUnitId: 'ru', slice: 'other', evidenceRefs: [], sourceCollections: ['llm_action_logs'] }],
    evaluations: [],
    metrics: {},
    transcriptCoverage: { observedCount: 60, transcriptWriteOutcomeCounts: { written: 44 }, transcriptCoverageStatus: 'ready' },
    decayAwareReadiness: buildDecayAwareReadiness(),
    kpiSummary: { overallStatus: 'warn' },
    issues: [],
    rootCauseReports: [],
    recommendedPr: [],
    planningStatus: 'blocked',
    sourceCollections: ['llm_action_logs']
  });

  const operatorEvidence = operator.evidence.find((item) => item.provenance === 'quality_patrol_decay_readiness');
  const humanEvidence = human.evidence.find((item) => item.provenance === 'quality_patrol_decay_readiness');

  assert.ok(operatorEvidence);
  assert.match(operatorEvidence.summary, /overall=historical_backlog_dominant/);
  assert.match(operatorEvidence.summary, /recentWindow=/);
  assert.ok(humanEvidence);
  assert.doesNotMatch(humanEvidence.summary, /historical_backlog_dominant/);
  assert.doesNotMatch(humanEvidence.summary, /recentWindow=/);
});
