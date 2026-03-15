'use strict';

const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../../tools/run_quality_patrol_metrics');
const { tempJsonPath, cleanupPaths } = require('./phase855_helpers');

function createReviewUnit(id, toAt) {
  return {
    reviewUnitId: id,
    traceId: `trace_${id}`,
    lineUserKey: `line_${id}`,
    sourceWindow: {
      fromAt: toAt,
      toAt
    },
    slice: 'other',
    userMessage: { text: 'user', available: true },
    assistantReply: { text: 'assistant', available: true },
    priorContextSummary: { text: '', available: false },
    telemetrySignals: {
      transcriptSnapshotOutcome: 'written',
      transcriptSnapshotReason: null
    },
    observationBlockers: [],
    evidenceRefs: [],
    sourceCollections: ['llm_action_logs']
  };
}

test('phase855: metrics artifact separates recent healthy runtime from unhealthy full backlog', async () => {
  const outputPath = tempJsonPath('metrics_decay_readiness');
  const fullReviewUnits = [
    createReviewUnit('ru_0', '2026-03-15T12:50:00.000Z'),
    createReviewUnit('ru_1', '2026-03-15T12:51:00.000Z'),
    createReviewUnit('ru_2', '2026-03-15T12:52:00.000Z'),
    createReviewUnit('ru_3', '2026-03-15T12:53:00.000Z'),
    createReviewUnit('ru_4', '2026-03-15T12:54:00.000Z'),
    createReviewUnit('ru_5', '2026-03-15T12:55:00.000Z')
  ];

  const deps = {
    buildConversationReviewUnitsFromSources: async (params) => {
      if (params && params.fromAt === '2026-03-15T12:51:00.000Z' && params.toAt === '2026-03-15T12:55:00.000Z') {
        return {
          ok: true,
          sourceWindow: { fromAt: '2026-03-15T12:51:00.000Z', toAt: '2026-03-15T12:55:00.000Z' },
          reviewUnits: fullReviewUnits.slice(1),
          transcriptCoverage: {
            observedCount: 5,
            writtenCount: 5,
            skippedCount: 0,
            failedCount: 0,
            transcriptWriteOutcomeCounts: {
              written: 5,
              skipped_flag_disabled: 0,
              skipped_missing_line_user_key: 0,
              skipped_unreviewable_transcript: 0,
              failed_repo_write: 0,
              failed_unknown: 0
            },
            transcriptWriteFailureReasons: {},
            snapshotInputDiagnostics: {
              assistant_reply_missing: 0,
              sanitized_reply_empty: 0,
              masking_removed_text: 0,
              region_prompt_fallback: 0,
              assistantReplyPresent: { trueCount: 5, falseCount: 0 },
              assistantReplyLength: { observedCount: 5, min: 24, max: 24, avg: 24 },
              sanitizedReplyLength: { observedCount: 5, min: 24, max: 24, avg: 24 },
              snapshotBuildAttempted: { trueCount: 5, falseCount: 0 },
              snapshotBuildSkippedReason: {
                feature_flag_off: 0,
                line_user_key_missing: 0,
                assistant_reply_missing: 0,
                sanitized_reply_empty: 0,
                masking_removed_text: 0,
                region_prompt_fallback: 0
              }
            },
            transcriptCoverageStatus: 'ready',
            sourceCollections: ['llm_action_logs']
          },
          sourceCollections: ['llm_action_logs'],
          counts: { snapshots: 5, llmActionLogs: 5, faqAnswerLogs: 0, traceBundles: 5 },
          joinDiagnostics: { faqOnlyRowsSkipped: 0, traceHydrationLimitedCount: 0, reviewUnitAnchorKindCounts: { snapshot_action: 5 } }
        };
      }
      return {
        ok: true,
        sourceWindow: { fromAt: '2026-03-15T12:50:00.000Z', toAt: '2026-03-15T12:55:00.000Z' },
        reviewUnits: fullReviewUnits,
        transcriptCoverage: {
          observedCount: 60,
          writtenCount: 44,
          skippedCount: 16,
          failedCount: 0,
          transcriptWriteOutcomeCounts: {
            written: 44,
            skipped_flag_disabled: 0,
            skipped_missing_line_user_key: 0,
            skipped_unreviewable_transcript: 16,
            failed_repo_write: 0,
            failed_unknown: 0
          },
          transcriptWriteFailureReasons: {
            transcript_unavailable: 16
          },
          snapshotInputDiagnostics: {
            assistant_reply_missing: 11,
            sanitized_reply_empty: 0,
            masking_removed_text: 0,
            region_prompt_fallback: 0,
            assistantReplyPresent: { trueCount: 44, falseCount: 11 },
            assistantReplyLength: { observedCount: 55, min: 0, max: 90, avg: 40 },
            sanitizedReplyLength: { observedCount: 55, min: 0, max: 90, avg: 40 },
            snapshotBuildAttempted: { trueCount: 55, falseCount: 0 },
            snapshotBuildSkippedReason: {
              feature_flag_off: 0,
              line_user_key_missing: 0,
              assistant_reply_missing: 11,
              sanitized_reply_empty: 0,
              masking_removed_text: 0,
              region_prompt_fallback: 0
            }
          },
          transcriptCoverageStatus: 'ready',
          sourceCollections: ['llm_action_logs']
        },
        sourceCollections: ['llm_action_logs'],
        counts: { snapshots: 6, llmActionLogs: 60, faqAnswerLogs: 10, traceBundles: 6 },
        joinDiagnostics: { faqOnlyRowsSkipped: 100, traceHydrationLimitedCount: 67, reviewUnitAnchorKindCounts: { snapshot_action: 6 } }
      };
    },
    evaluateConversationReviewUnits: async (params) => ({
      ok: true,
      sourceWindow: { fromAt: params.fromAt || '2026-03-15T12:50:00.000Z', toAt: params.toAt || '2026-03-15T12:55:00.000Z' },
      evaluations: Array.isArray(params.reviewUnits) ? params.reviewUnits.map((unit) => ({
        reviewUnitId: unit.reviewUnitId,
        slice: unit.slice,
        status: 'warn',
        observationBlockers: [],
        signals: {},
        issueCandidates: [],
        supportingEvidence: [],
        provenance: 'review_unit',
        sourceCollections: ['llm_action_logs']
      })) : [],
      counts: { reviewUnits: Array.isArray(params.reviewUnits) ? params.reviewUnits.length : 0, blocked: 0, fail: 0, warn: 0 },
      sourceCollections: ['llm_action_logs']
    }),
    detectIssues: () => ({
      summary: { issueCount: 0, blockedCount: 0, openCount: 0, watchingCount: 0, byType: {}, bySlice: {} },
      issueCandidates: [],
      backlogCandidates: [],
      provenance: 'quality_patrol_detection',
      sourceCollections: []
    }),
    analyzeQualityIssues: async () => ({
      summary: { reportCount: 0, analyzedCount: 0, blockedCount: 0, insufficientEvidenceCount: 0, byAnalysisStatus: {}, byCauseType: {} },
      rootCauseReports: [],
      provenance: 'quality_patrol_root_cause_analysis',
      sourceCollections: []
    }),
    planQualityImprovements: async () => ({
      planVersion: 'quality_patrol_improvement_plan_v1',
      generatedAt: '2026-03-15T00:00:00.000Z',
      summary: { topPriorityCount: 0, observationOnlyCount: 0, runtimeFixCount: 0 },
      recommendedPr: [],
      observationBlockers: [],
      planningStatus: 'blocked',
      provenance: 'quality_patrol_improvement_planner',
      sourceCollections: []
    }),
    queryLatestPatrolInsights: async () => ({
      queryVersion: 'quality_patrol_query_v1',
      generatedAt: '2026-03-15T00:00:00.000Z',
      audience: 'operator',
      summary: { overallStatus: 'blocked', topFindings: [], topPriorityCount: 0, observationBlockerCount: 0 },
      issues: [],
      observationBlockers: [],
      evidence: [],
      traceRefs: [],
      recommendedPr: [],
      observationStatus: 'blocked',
      provenance: 'quality_patrol_query',
      sourceCollections: ['llm_action_logs']
    }),
    listOpenIssues: async () => [],
    listTopPriorityBacklog: async () => []
  };

  await run([
    'node',
    'tools/run_quality_patrol_metrics.js',
    '--output',
    outputPath
  ], deps);

  const artifact = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.ok(artifact.decayAwareReadiness);
  assert.equal(artifact.decayAwareReadiness.recentWindowStatus, 'healthy');
  assert.equal(artifact.decayAwareReadiness.overallReadinessStatus, 'historical_backlog_dominant');
  assert.equal(artifact.decayAwareReadiness.recentWindow.written, 5);
  assert.equal(artifact.decayAwareReadiness.fullWindow.skipped_unreviewable_transcript, 16);
  assert.equal(artifact.decayAwareReadiness.fullWindow.assistant_reply_missing, 11);

  cleanupPaths(outputPath);
});
