'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildPatrolKpis } = require('../../src/domain/qualityPatrol/buildPatrolKpis');

test('phase845: transcript coverage diagnostics stay separate from transcript availability rates', () => {
  const result = buildPatrolKpis({
    reviewUnits: [
      {
        reviewUnitId: 'ru_phase845_transcript_cov',
        slice: 'other',
        userMessage: { available: true, text: 'user' },
        assistantReply: { available: true, text: 'assistant' },
        priorContextSummary: { available: false, text: '' },
        observationBlockers: [],
        sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
      }
    ],
    evaluations: [],
    transcriptCoverage: {
      observedCount: 3,
      writtenCount: 1,
      skippedCount: 1,
      failedCount: 1,
      transcriptWriteOutcomeCounts: {
        written: 1,
        skipped_flag_disabled: 0,
        skipped_missing_line_user_key: 1,
        skipped_unreviewable_transcript: 0,
        failed_repo_write: 1,
        failed_unknown: 0
      },
      transcriptWriteFailureReasons: {
        line_user_key_missing: 1,
        repo_write_failed: 1
      },
      snapshotInputDiagnostics: {
        assistantReplyPresent: {
          trueCount: 1,
          falseCount: 0
        },
        assistantReplyLength: {
          observedCount: 1,
          min: 24,
          max: 24,
          avg: 24
        },
        sanitizedReplyLength: {
          observedCount: 1,
          min: 18,
          max: 18,
          avg: 18
        },
        snapshotBuildAttempted: {
          trueCount: 2,
          falseCount: 1
        },
        snapshotBuildSkippedReason: {
          feature_flag_off: 0,
          line_user_key_missing: 1,
          assistant_reply_missing: 0,
          sanitized_reply_empty: 0,
          masking_removed_text: 0,
          region_prompt_fallback: 0
        }
      },
      transcriptCoverageStatus: 'warn',
      sourceCollections: ['llm_action_logs']
    }
  });

  assert.equal(result.metrics.userMessageAvailableRate.value, 1);
  assert.equal(result.metrics.assistantReplyAvailableRate.value, 1);
  assert.equal(result.metrics.reviewableTranscriptRate.value, 1);
  assert.equal(result.transcriptCoverage.transcriptWriteOutcomeCounts.failed_repo_write, 1);
  assert.equal(result.transcriptCoverage.transcriptWriteOutcomeCounts.skipped_missing_line_user_key, 1);
  assert.equal(result.transcriptCoverage.transcriptWriteFailureReasons.repo_write_failed, 1);
  assert.equal(result.transcriptCoverage.snapshotInputDiagnostics.assistantReplyPresent.trueCount, 1);
  assert.equal(result.transcriptCoverage.snapshotInputDiagnostics.snapshotBuildAttempted.trueCount, 2);
  assert.equal(result.transcriptCoverage.snapshotInputDiagnostics.snapshotBuildSkippedReason.line_user_key_missing, 1);
  assert.equal(result.transcriptCoverage.transcriptCoverageStatus, 'warn');
});
