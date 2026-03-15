'use strict';

const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../../tools/run_quality_patrol');
const { tempJsonPath, cleanupPaths, buildPatrolDeps } = require('./phase855_helpers');

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
      transcriptCoverageStatus: 'ready',
      sourceCollections: ['llm_action_logs']
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
    observationBlockers: [{ code: 'action_trace_join_limited' }],
    provenance: 'review_unit_evaluator',
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
      proposalKey: 'proposal_observation_gap_001',
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

test('phase855: human patrol artifact removes internal taxonomy while keeping decision and backlog summary', async () => {
  const outputPath = tempJsonPath('human_privacy_surface');
  const rawKpiResult = buildRawKpiResult();
  const rawRootCauseResult = buildRootCauseResult(rawKpiResult);
  const rawPlanResult = buildPlanResult();
  const deps = buildPatrolDeps({
    buildPatrolKpisFromEvaluations: async () => rawKpiResult,
    analyzeQualityIssues: async () => rawRootCauseResult,
    planQualityImprovements: async () => rawPlanResult
  });

  await run([
    'node',
    'tools/run_quality_patrol.js',
    '--mode',
    'newly-detected-improvements',
    '--audience',
    'human',
    '--output',
    outputPath
  ], deps);

  const artifact = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  const serialized = JSON.stringify(artifact);
  FORBIDDEN_STRINGS.forEach((value) => {
    assert.equal(serialized.includes(value), false, `human artifact leaked ${value}`);
  });

  assert.ok(artifact.transcriptCoverage);
  assert.ok(!('snapshotInputDiagnostics' in artifact.transcriptCoverage));
  assert.ok(!('transcriptWriteOutcomeCounts' in artifact.transcriptCoverage));
  assert.ok(artifact.decayAwareReadiness);
  assert.equal(artifact.decayAwareReadiness.overallReadinessStatus, 'readiness_deferred');
  assert.ok(!('decisionReasonCode' in artifact.decayAwareOpsGate));
  assert.equal(artifact.decayAwareOpsGate.decision, 'NO_GO');
  assert.equal(artifact.decayAwareOpsGate.prDStatus, 'deferred');
  assert.ok(typeof artifact.decayAwareOpsGate.operatorAction === 'string');
  assert.equal(artifact.traceRefs.length, 0);
  assert.equal(artifact.backlogSeparation.backlogSeparationGate.decision, 'NO_GO');
  assert.equal(artifact.backlogSeparation.backlogSeparationGate.prDStatus, 'deferred');
  assert.ok(artifact.observationBlockers.every((item) => !('code' in item)));
  assert.ok(artifact.rootCauseResult);
  assert.ok(!('kpiResult' in artifact.rootCauseResult));
  assert.ok(artifact.planResult);
  assert.ok(Array.isArray(artifact.planResult.recommendedPr));

  cleanupPaths(outputPath);
});
