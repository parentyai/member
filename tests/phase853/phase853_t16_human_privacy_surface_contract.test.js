'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { queryLatestPatrolInsights } = require('../../src/usecases/qualityPatrol/queryLatestPatrolInsights');

const FORBIDDEN_STRINGS = [
  'historical_backlog_dominant',
  'action_trace_join_limited',
  'assistant_reply_missing',
  'skipped_unreviewable_transcript',
  'prDReasonCode',
  'decisionReasonCode',
  'blockerCodes'
];

function buildRawKpiResult() {
  return {
    summary: {
      overallStatus: 'blocked',
      reviewUnitCount: 5,
      sliceCounts: { other: 5 }
    },
    metrics: {},
    issueCandidateMetrics: {},
    transcriptCoverage: {
      observedCount: 65,
      writtenCount: 49,
      skippedCount: 16,
      failedCount: 0,
      transcriptWriteOutcomeCounts: {
        written: 49,
        skipped_unreviewable_transcript: 16
      },
      transcriptWriteFailureReasons: {
        transcript_unavailable: 16
      },
      snapshotInputDiagnostics: {
        assistant_reply_missing: 11,
        snapshotBuildSkippedReason: {
          assistant_reply_missing: 11
        }
      },
      transcriptCoverageStatus: 'ready'
    },
    decayAwareReadiness: {
      recentWindowStatus: 'healthy',
      historicalBacklogStatus: 'stagnating',
      overallReadinessStatus: 'historical_backlog_dominant',
      recentWindow: {
        sourceWindow: {
          fromAt: '2026-03-15T17:00:21.966Z',
          toAt: '2026-03-15T17:00:29.819Z'
        },
        observedCount: 5,
        written: 5,
        reviewUnitCount: 5,
        blockerCount: 0
      },
      fullWindow: {
        sourceWindow: {
          fromAt: '2026-03-14T04:21:46.190Z',
          toAt: '2026-03-15T17:00:29.819Z'
        },
        observedCount: 90,
        written: 74,
        skipped_unreviewable_transcript: 16,
        assistant_reply_missing: 11,
        reviewUnitCount: 90,
        faqOnlyRowsSkipped: 100,
        traceHydrationLimitedCount: 71,
        blockerCount: 71
      },
      historicalDebt: {
        trend: 'stagnating',
        transcriptDebtCount: 27,
        joinDebtCount: 71,
        blockerCount: 71,
        dominantDebt: 'transcript_coverage'
      },
      currentRuntimeHealth: {
        status: 'healthy',
        observedCount: 5,
        reviewUnitCount: 5,
        transcriptWriteCoverageHealthy: true,
        joinHealthy: true
      }
    },
    decayAwareOpsGate: {
      decision: 'NO_GO',
      decisionReasonCode: 'historical_backlog_dominant',
      operatorAction: 'separate_historical_backlog_from_current_runtime',
      prDEligible: false,
      prDStatus: 'deferred',
      prDReasonCode: 'historical_backlog_present',
      recentWindowStatus: 'healthy',
      historicalBacklogStatus: 'stagnating',
      overallReadinessStatus: 'historical_backlog_dominant'
    },
    observationBlockers: [],
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'trace_bundle']
  };
}

function buildRootCauseResult(kpiResult) {
  return {
    summary: {
      reportCount: 1,
      analyzedCount: 0,
      blockedCount: 1,
      insufficientEvidenceCount: 0,
      byAnalysisStatus: { blocked: 1 },
      byCauseType: { observation_gap: 1 }
    },
    rootCauseReports: [{
      issueKey: 'issue_quality_patrol_001',
      slice: 'other',
      analysisStatus: 'blocked',
      rootCauseSummary: '観測不足のため runtime 原因を断定できません。',
      causeCandidates: [{
        causeType: 'observation_gap',
        rank: 1,
        confidence: 'high',
        supportingSignals: ['action_trace_join_limited'],
        supportingEvidence: [],
        evidenceGaps: []
      }],
      observationBlockers: [{
        code: 'action_trace_join_limited',
        message: 'trace hydration is limited',
        source: 'trace_bundle'
      }]
    }],
    provenance: 'quality_patrol_root_cause_analysis',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'trace_bundle'],
    kpiResult
  };
}

function buildPlanResult() {
  return {
    ok: true,
    planVersion: 'quality_patrol_improvement_plan_v1',
    generatedAt: '2026-03-15T17:01:00.000Z',
    summary: {
      topPriorityCount: 1,
      observationOnlyCount: 1,
      runtimeFixCount: 0
    },
    recommendedPr: [{
      proposalKey: 'observation-gap-followup',
      proposalType: 'blocked_by_observation_gap',
      title: 'Observation gap follow-up',
      priority: 'P1',
      objective: 'Close the remaining observation gap before runtime repair.',
      whyNow: 'historical backlog is still dominant',
      riskLevel: 'low',
      blockedBy: ['action_trace_join_limited']
    }],
    observationBlockers: [{
      code: 'action_trace_join_limited',
      message: 'trace hydration is limited',
      source: 'trace_bundle'
    }],
    planningStatus: 'blocked',
    provenance: 'quality_patrol_improvement_planner',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'trace_bundle']
  };
}

test('phase853: human query surface strips internal taxonomy while preserving decision and prD status', async () => {
  const kpiResult = buildRawKpiResult();
  const rootCauseResult = buildRootCauseResult(kpiResult);
  const planResult = buildPlanResult();

  const result = await queryLatestPatrolInsights({
    mode: 'newly-detected-improvements',
    audience: 'human',
    reviewUnits: [],
    evaluations: [],
    kpiResult,
    detectionResult: {
      summary: {},
      issueCandidates: [],
      backlogCandidates: [],
      provenance: 'quality_patrol_detection',
      sourceCollections: ['conversation_review_snapshots']
    },
    rootCauseResult,
    planResult
  }, {
    listOpenIssues: async () => [],
    listTopPriorityBacklog: async () => []
  });

  const serialized = JSON.stringify(result);
  FORBIDDEN_STRINGS.forEach((value) => {
    assert.equal(serialized.includes(value), false, `human surface leaked ${value}`);
  });

  assert.equal(result.backlogSeparation.backlogSeparationGate.decision, 'NO_GO');
  assert.equal(result.backlogSeparation.backlogSeparationGate.prDStatus, 'deferred');
  assert.ok(typeof result.backlogSeparation.backlogSeparationGate.operatorAction === 'string');
  assert.ok(result.rootCauseResult);
  assert.ok(result.planResult);
  assert.ok(result.decayAwareReadiness === undefined);
  assert.ok(result.observationBlockers.every((item) => !('code' in item)));
});

test('phase853: operator query surface keeps internal taxonomy for diagnosis', async () => {
  const kpiResult = buildRawKpiResult();
  const rootCauseResult = buildRootCauseResult(kpiResult);
  const planResult = buildPlanResult();

  const result = await queryLatestPatrolInsights({
    mode: 'latest',
    audience: 'operator',
    reviewUnits: [],
    evaluations: [],
    kpiResult,
    detectionResult: {
      summary: {},
      issueCandidates: [],
      backlogCandidates: [],
      provenance: 'quality_patrol_detection',
      sourceCollections: ['conversation_review_snapshots']
    },
    rootCauseResult,
    planResult
  }, {
    listOpenIssues: async () => [],
    listTopPriorityBacklog: async () => []
  });

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('historical_backlog_dominant'), true);
  assert.equal(serialized.includes('prDReasonCode'), true);
  assert.equal(serialized.includes('action_trace_join_limited'), true);
});
