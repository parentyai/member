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
      blockerCodes: ['observation_gap', 'transcript_write_coverage_missing']
    },
    previousFullWindow: {
      sourceWindow: { fromAt: '2026-03-13T12:00:00.000Z', toAt: '2026-03-14T12:00:00.000Z' },
      observedCount: 55,
      written: 39,
      skipped_unreviewable_transcript: 16,
      assistant_reply_missing: 11,
      reviewUnitCount: 114,
      faqOnlyRowsSkipped: 100,
      traceHydrationLimitedCount: 67,
      blockerCount: 4,
      blockerCodes: ['observation_gap', 'transcript_write_coverage_missing']
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
      traceHydrationLimitedCount: 0,
      blockerCount: 0
    },
    historicalDebt: {
      status: 'present',
      trend: 'stagnating',
      sourceWindow: { fromAt: '2026-03-14T12:00:00.000Z', toAt: '2026-03-15T13:00:00.000Z' },
      observedCount: 60,
      reviewUnitCount: 117,
      debtCounts: {
        skipped_unreviewable_transcript: 16,
        assistant_reply_missing: 11,
        faq_only_rows_skipped: 100,
        action_trace_join_limited: 67,
        blocker_count: 4
      },
      totalDebtCount: 198,
      transcriptDebtCount: 27,
      joinDebtCount: 167,
      dominantDebt: 'join_limit',
      blockerCount: 4
    },
    currentRuntimeHealth: {
      status: 'healthy',
      sourceWindow: { fromAt: '2026-03-15T12:00:00.000Z', toAt: '2026-03-15T13:00:00.000Z' },
      observedCount: 5,
      reviewUnitCount: 5,
      transcriptWriteCoverageHealthy: true,
      joinHealthy: true
    }
  };
}

function buildDecayAwareOpsGate() {
  return {
    gateVersion: 'quality_patrol_decay_ops_gate_v1',
    decision: 'NO_GO',
    decisionReasonCode: 'historical_backlog_dominant',
    operatorAction: 'separate_historical_backlog_from_current_runtime',
    recentWindowStatus: 'healthy',
    historicalBacklogStatus: 'stagnating',
    overallReadinessStatus: 'historical_backlog_dominant',
    prDEligible: false,
    prDStatus: 'deferred',
    prDReasonCode: 'historical_backlog_present'
  };
}

function buildResponse(audience) {
  return buildPatrolQueryResponse({
    audience,
    mode: 'latest',
    reviewUnits: [{ reviewUnitId: 'ru', slice: 'other', evidenceRefs: [], sourceCollections: ['llm_action_logs'] }],
    evaluations: [],
    metrics: {},
    transcriptCoverage: { observedCount: 60, transcriptWriteOutcomeCounts: { written: 44 }, transcriptCoverageStatus: 'ready' },
    decayAwareReadiness: buildDecayAwareReadiness(),
    decayAwareOpsGate: buildDecayAwareOpsGate(),
    kpiSummary: { overallStatus: 'warn' },
    issues: [],
    rootCauseReports: [],
    recommendedPr: [],
    planningStatus: 'blocked',
    sourceCollections: ['llm_action_logs']
  });
}

test('phase856: query top-level shape remains intact and backlog separation is add-only', () => {
  const result = buildResponse('operator');

  assert.equal(result.queryVersion, 'quality_patrol_query_v1');
  assert.ok(result.summary);
  assert.ok(Array.isArray(result.issues));
  assert.ok(Array.isArray(result.observationBlockers));
  assert.ok(Array.isArray(result.evidence));
  assert.ok(Array.isArray(result.traceRefs));
  assert.ok(Array.isArray(result.recommendedPr));
  assert.ok(result.backlogSeparation);
  assert.equal(result.backlogSeparation.currentRuntime.status, 'healthy');
});

test('phase856: operator evidence returns structured backlog separation summary', () => {
  const operator = buildResponse('operator');
  const evidence = operator.evidence.find((item) => item.provenance === 'quality_patrol_backlog_separation');

  assert.ok(evidence);
  assert.match(evidence.summary, /decision=NO_GO/);
  assert.ok(evidence.structuredSummary);
  assert.equal(evidence.structuredSummary.backlogSeparationGate.reasonCode, 'historical_backlog_dominant');
  assert.equal(evidence.structuredSummary.historicalDebt.debtCounts.skipped_unreviewable_transcript, 16);
  assert.equal(evidence.structuredSummary.backlogSeparationGate.operatorAction, 'separate_historical_backlog_from_current_runtime');
});

test('phase856: human evidence stays privacy-safe and hides internal taxonomy', () => {
  const human = buildResponse('human');
  const evidence = human.evidence.find((item) => item.provenance === 'quality_patrol_backlog_separation');

  assert.ok(evidence);
  assert.doesNotMatch(evidence.summary, /historical_backlog_dominant/);
  assert.ok(evidence.structuredSummary);
  assert.equal('reasonCode' in evidence.structuredSummary.backlogSeparationGate, false);
  assert.equal('debtCounts' in evidence.structuredSummary.historicalDebt, false);
  assert.equal(human.traceRefs.length, 0);
});
