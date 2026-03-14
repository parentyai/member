'use strict';

const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../../tools/run_quality_patrol');
const { tempJsonPath, cleanupPaths, buildPatrolDeps } = require('./phase855_helpers');

test('phase855: patrol artifact preserves precision blocker taxonomy without changing top-level contract', async () => {
  const outputPath = tempJsonPath('blocker_precision');
  const deps = buildPatrolDeps({
    buildConversationReviewUnitsFromSources: async () => ({
      ok: true,
      sourceWindow: { fromAt: '2026-03-14T00:00:00.000Z', toAt: '2026-03-14T01:00:00.000Z' },
      reviewUnits: [{
        reviewUnitId: 'ru_precision_1',
        evidenceJoinStatus: {
          actionLog: 'joined',
          trace: 'limited_by_trace_hydration',
          faq: 'not_expected'
        }
      }],
      transcriptCoverage: {
        observedCount: 0,
        transcriptCoverageStatus: 'unavailable',
        transcriptWriteOutcomeCounts: {},
        transcriptWriteFailureReasons: {}
      },
      sourceCollections: ['llm_action_logs', 'trace_bundle'],
      counts: { snapshots: 0, llmActionLogs: 2, faqAnswerLogs: 0, traceBundles: 1 },
      joinDiagnostics: {
        faqOnlyRowsSkipped: 0,
        traceHydrationLimitedCount: 1,
        reviewUnitAnchorKindCounts: { action_only: 1 }
      }
    }),
    detectIssues: () => ({
      summary: { issueCount: 1, blockedCount: 1, openCount: 1, watchingCount: 0, byType: { observation_blocker: 1 }, bySlice: { other: 1 } },
      issueCandidates: [{
        issueType: 'observation_blocker',
        issueKey: 'issue_precision_1',
        title: 'Observation gap remains',
        summary: 'runtime evidence is still blocked',
        severity: 'high',
        status: 'blocked',
        category: 'observation_gap',
        slice: 'other',
        provenance: 'quality_patrol_detection',
        observationBlockers: [
          { code: 'missing_user_message', severity: 'high', message: 'Masked user message snapshot is unavailable.', source: 'conversation_review_snapshots' },
          { code: 'insufficient_knowledge_signals', severity: 'low', message: 'knowledge-use judgement needs candidate availability or reuse signals', source: 'conversation_quality_evaluator' }
        ],
        supportingEvidence: []
      }],
      backlogCandidates: [],
      provenance: 'quality_patrol_detection',
      sourceCollections: ['llm_action_logs', 'trace_bundle']
    }),
    analyzeQualityIssues: async () => ({
      summary: { reportCount: 1, analyzedCount: 0, blockedCount: 1, insufficientEvidenceCount: 0, byAnalysisStatus: { blocked: 1 }, byCauseType: { observation_gap: 1 } },
      rootCauseReports: [{
        issueKey: 'issue_precision_1',
        slice: 'other',
        causeCandidates: [{ causeType: 'observation_gap', confidence: 'medium', rank: 1 }],
        observationBlockers: [
          { code: 'missing_user_message', severity: 'high', message: 'Masked user message snapshot is unavailable.', source: 'conversation_review_snapshots' },
          { code: 'insufficient_knowledge_signals', severity: 'low', message: 'knowledge-use judgement needs candidate availability or reuse signals', source: 'conversation_quality_evaluator' }
        ],
        analysisStatus: 'blocked'
      }],
      provenance: 'quality_patrol_root_cause_analysis',
      sourceCollections: ['llm_action_logs', 'trace_bundle']
    }),
    planQualityImprovements: async () => ({
      ok: true,
      planVersion: 'quality_patrol_improvement_plan_v1',
      generatedAt: '2026-03-14T18:55:00.000Z',
      summary: { topPriorityCount: 1, observationOnlyCount: 1, runtimeFixCount: 0 },
      recommendedPr: [{
        proposalKey: 'proposal_observation_gap',
        proposalType: 'blocked_by_observation_gap',
        priority: 'P1',
        title: 'Quality Patrol observation gap unblocker',
        objective: 'Close observation gaps before proposing runtime fixes.',
        whyNow: 'Observation gap is still active.',
        riskLevel: 'low',
        blockedBy: ['missing_user_message']
      }],
      observationBlockers: [],
      planningStatus: 'blocked',
      provenance: 'quality_patrol_improvement_planner',
      sourceCollections: ['llm_action_logs', 'trace_bundle']
    })
  });

  await run([
    'node',
    'tools/run_quality_patrol.js',
    '--mode',
    'latest',
    '--output',
    outputPath
  ], deps);

  const artifact = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(artifact.artifactVersion, 'quality_patrol_job_v1');
  assert.ok(Array.isArray(artifact.observationBlockers));
  assert.deepEqual(
    artifact.observationBlockers.map((item) => item.code),
    ['observation_gap', 'transcript_write_coverage_missing', 'action_trace_join_limited', 'insufficient_runtime_evidence']
  );
  assert.equal(artifact.queryVersion, 'quality_patrol_query_v1');

  cleanupPaths(outputPath);
});
