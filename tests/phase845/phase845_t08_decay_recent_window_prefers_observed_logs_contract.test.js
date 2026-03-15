'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildPatrolKpisFromEvaluations } = require('../../src/usecases/qualityPatrol/buildPatrolKpisFromEvaluations');

function createReviewUnit(id, at) {
  return {
    reviewUnitId: id,
    traceId: `trace_${id}`,
    slice: 'other',
    sourceWindow: {
      fromAt: at,
      toAt: at
    },
    userMessage: { available: false, text: '' },
    assistantReply: { available: false, text: '' },
    priorContextSummary: { available: false, text: '' },
    observationBlockers: [
      { code: 'missing_user_message' },
      { code: 'missing_assistant_reply' },
      { code: 'transcript_not_reviewable' }
    ],
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  };
}

function createEvaluation(reviewUnitId) {
  return {
    reviewUnitId,
    slice: 'other',
    status: 'blocked',
    observationBlockers: [],
    signals: {},
    issueCandidates: [],
    supportingEvidence: [],
    provenance: 'review_unit',
    sourceCollections: ['llm_action_logs']
  };
}

function createActionLog(id, at, outcome) {
  return {
    actionLogId: id,
    createdAt: at,
    transcriptSnapshotOutcome: outcome,
    transcriptSnapshotReason: outcome === 'skipped_unreviewable_transcript' ? 'transcript_unavailable' : null,
    transcriptSnapshotAssistantReplyPresent: outcome === 'written',
    transcriptSnapshotAssistantReplyLength: outcome === 'written' ? 42 : 0,
    transcriptSnapshotSanitizedReplyLength: outcome === 'written' ? 42 : 0,
    transcriptSnapshotBuildAttempted: true,
    transcriptSnapshotBuildSkippedReason: outcome === 'written' ? null : 'assistant_reply_missing'
  };
}

test('phase845: recent window prefers observed action logs over snapshot-only review units', async () => {
  const fullReviewUnits = [
    createReviewUnit('ru_0', '2026-03-15T12:50:00.000Z'),
    createReviewUnit('ru_1', '2026-03-15T12:51:00.000Z'),
    createReviewUnit('ru_2', '2026-03-15T12:52:00.000Z'),
    createReviewUnit('ru_3', '2026-03-15T12:53:00.000Z'),
    createReviewUnit('ru_4', '2026-03-15T12:54:00.000Z'),
    createReviewUnit('ru_5', '2026-03-15T12:55:00.000Z')
  ];
  const recentRange = { fromAt: '2026-03-15T12:51:00.000Z', toAt: '2026-03-15T12:55:00.000Z' };

  const llmActionLogs = [
    createActionLog('al_0', '2026-03-15T12:50:00.000Z', 'skipped_unreviewable_transcript'),
    createActionLog('al_1', '2026-03-15T12:51:00.000Z', 'written'),
    createActionLog('al_2', '2026-03-15T12:52:00.000Z', 'written'),
    createActionLog('al_3', '2026-03-15T12:53:00.000Z', 'written'),
    createActionLog('al_4', '2026-03-15T12:54:00.000Z', 'written'),
    createActionLog('al_5', '2026-03-15T12:55:00.000Z', 'written')
  ];

  const result = await buildPatrolKpisFromEvaluations({}, {
    buildConversationReviewUnitsFromSources: async (params) => {
      if (params && params.fromAt === recentRange.fromAt && params.toAt === recentRange.toAt) {
        return {
          ok: true,
          sourceWindow: recentRange,
          reviewUnits: fullReviewUnits.slice(1),
          llmActionLogs: [],
          transcriptCoverage: {
            observedCount: 0,
            writtenCount: 0,
            skippedCount: 0,
            failedCount: 0,
            transcriptWriteOutcomeCounts: {
              written: 0,
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
              assistantReplyPresent: { trueCount: 0, falseCount: 0 },
              assistantReplyLength: { observedCount: 0, min: null, max: null, avg: 0 },
              sanitizedReplyLength: { observedCount: 0, min: null, max: null, avg: 0 },
              snapshotBuildAttempted: { trueCount: 0, falseCount: 0 },
              snapshotBuildSkippedReason: {
                feature_flag_off: 0,
                line_user_key_missing: 0,
                assistant_reply_missing: 0,
                sanitized_reply_empty: 0,
                masking_removed_text: 0,
                region_prompt_fallback: 0
              }
            },
            transcriptCoverageStatus: 'unavailable',
            sourceCollections: ['llm_action_logs']
          },
          sourceCollections: ['llm_action_logs'],
          joinDiagnostics: { faqOnlyRowsSkipped: 0, traceHydrationLimitedCount: 0, reviewUnitAnchorKindCounts: { snapshot_only: 5 } }
        };
      }
      return {
        ok: true,
        sourceWindow: { fromAt: '2026-03-15T12:50:00.000Z', toAt: '2026-03-15T12:55:00.000Z' },
        reviewUnits: fullReviewUnits,
        llmActionLogs,
        transcriptCoverage: {
          observedCount: 6,
          writtenCount: 5,
          skippedCount: 1,
          failedCount: 0,
          transcriptWriteOutcomeCounts: {
            written: 5,
            skipped_flag_disabled: 0,
            skipped_missing_line_user_key: 0,
            skipped_unreviewable_transcript: 1,
            failed_repo_write: 0,
            failed_unknown: 0
          },
          transcriptWriteFailureReasons: { transcript_unavailable: 1 },
          snapshotInputDiagnostics: {
            assistant_reply_missing: 1,
            sanitized_reply_empty: 0,
            masking_removed_text: 0,
            region_prompt_fallback: 0,
            assistantReplyPresent: { trueCount: 5, falseCount: 1 },
            assistantReplyLength: { observedCount: 6, min: 0, max: 42, avg: 35 },
            sanitizedReplyLength: { observedCount: 6, min: 0, max: 42, avg: 35 },
            snapshotBuildAttempted: { trueCount: 6, falseCount: 0 },
            snapshotBuildSkippedReason: {
              feature_flag_off: 0,
              line_user_key_missing: 0,
              assistant_reply_missing: 1,
              sanitized_reply_empty: 0,
              masking_removed_text: 0,
              region_prompt_fallback: 0
            }
          },
          transcriptCoverageStatus: 'ready',
          sourceCollections: ['llm_action_logs']
        },
        sourceCollections: ['llm_action_logs'],
        joinDiagnostics: { faqOnlyRowsSkipped: 12, traceHydrationLimitedCount: 7, reviewUnitAnchorKindCounts: { snapshot_only: 6 } }
      };
    },
    evaluateConversationReviewUnits: async (params) => ({
      ok: true,
      sourceWindow: { fromAt: params.fromAt || '2026-03-15T12:50:00.000Z', toAt: params.toAt || '2026-03-15T12:55:00.000Z' },
      evaluations: (params.reviewUnits || []).map((unit) => createEvaluation(unit.reviewUnitId)),
      counts: { reviewUnits: (params.reviewUnits || []).length, blocked: (params.reviewUnits || []).length, fail: 0, warn: 0 },
      sourceCollections: ['llm_action_logs']
    })
  });

  assert.equal(result.decayAwareReadiness.recentWindowStatus, 'healthy');
  assert.equal(result.decayAwareReadiness.recentWindow.observedCount, 5);
  assert.equal(result.decayAwareReadiness.recentWindow.written, 5);
  assert.equal(result.decayAwareReadiness.recentWindow.assistant_reply_missing, 0);
  assert.equal(result.decayAwareReadiness.overallReadinessStatus, 'observation_continue_backlog_decay');
});
