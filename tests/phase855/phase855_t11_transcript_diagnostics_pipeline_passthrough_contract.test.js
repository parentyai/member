'use strict';

const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../../tools/run_quality_patrol_metrics');
const { tempJsonPath, cleanupPaths } = require('./phase855_helpers');

test('phase855: metrics pipeline keeps extractor transcript diagnostics when review units are already loaded', async () => {
  const outputPath = tempJsonPath('metrics_passthrough');
  const deps = {
    buildConversationReviewUnitsFromSources: async () => ({
      ok: true,
      sourceWindow: { fromAt: '2026-03-15T00:00:00.000Z', toAt: '2026-03-15T01:00:00.000Z' },
      reviewUnits: [
        {
          reviewUnitId: 'ru_passthrough_001',
          traceId: 'trace_passthrough_001',
          lineUserKey: 'line_key_passthrough_001',
          slice: 'broad',
          userMessage: { text: 'user', available: true },
          assistantReply: { text: '', available: false },
          priorContextSummary: { text: '', available: false },
          telemetrySignals: {
            transcriptSnapshotOutcome: 'skipped_unreviewable_transcript',
            transcriptSnapshotReason: 'transcript_unavailable'
          },
          observationBlockers: [],
          evidenceRefs: [],
          sourceCollections: ['llm_action_logs']
        }
      ],
      transcriptCoverage: {
        observedCount: 1,
        writtenCount: 0,
        skippedCount: 1,
        failedCount: 0,
        transcriptWriteOutcomeCounts: {
          written: 0,
          skipped_flag_disabled: 0,
          skipped_missing_line_user_key: 0,
          skipped_unreviewable_transcript: 1,
          failed_repo_write: 0,
          failed_unknown: 0
        },
        transcriptWriteFailureReasons: {
          transcript_unavailable: 1
        },
        snapshotInputDiagnostics: {
          assistant_reply_missing: 1,
          sanitized_reply_empty: 0,
          masking_removed_text: 0,
          region_prompt_fallback: 0,
          assistantReplyPresent: { trueCount: 0, falseCount: 1 },
          assistantReplyLength: { observedCount: 1, min: 0, max: 0, avg: 0 },
          sanitizedReplyLength: { observedCount: 1, min: 0, max: 0, avg: 0 },
          snapshotBuildAttempted: { trueCount: 1, falseCount: 0 },
          snapshotBuildSkippedReason: {
            feature_flag_off: 0,
            line_user_key_missing: 0,
            assistant_reply_missing: 1,
            sanitized_reply_empty: 0,
            masking_removed_text: 0,
            region_prompt_fallback: 0
          }
        },
        transcriptCoverageStatus: 'blocked',
        sourceCollections: ['llm_action_logs']
      },
      sourceCollections: ['llm_action_logs'],
      counts: { snapshots: 0, llmActionLogs: 1, faqAnswerLogs: 0, traceBundles: 0 },
      joinDiagnostics: { faqOnlyRowsSkipped: 0, traceHydrationLimitedCount: 0, reviewUnitAnchorKindCounts: { action_only: 1 } }
    }),
    evaluateConversationReviewUnits: async () => ({
      ok: true,
      sourceWindow: { fromAt: '2026-03-15T00:00:00.000Z', toAt: '2026-03-15T01:00:00.000Z' },
      evaluations: [],
      counts: { reviewUnits: 1, blocked: 0, fail: 0, warn: 0 },
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
  assert.equal(artifact.transcriptCoverage.observedCount, 1);
  assert.equal(artifact.transcriptCoverage.snapshotInputDiagnostics.assistant_reply_missing, 1);
  assert.equal(artifact.transcriptCoverage.snapshotInputDiagnostics.assistantReplyPresent.falseCount, 1);
  assert.equal(artifact.transcriptCoverage.snapshotInputDiagnostics.snapshotBuildAttempted.trueCount, 1);

  cleanupPaths(outputPath);
});
