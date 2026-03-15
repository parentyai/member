'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildTranscriptCoverageDiagnostics
} = require('../../src/domain/qualityPatrol/transcript/buildTranscriptCoverageDiagnostics');

test('phase845: transcript coverage diagnostics aggregate snapshot input skip taxonomy without changing outcome contract', () => {
  const diagnostics = buildTranscriptCoverageDiagnostics({
    llmActionLogs: [
      {
        transcriptSnapshotOutcome: 'skipped_unreviewable_transcript',
        transcriptSnapshotReason: 'transcript_unavailable',
        transcriptSnapshotAssistantReplyPresent: false,
        transcriptSnapshotAssistantReplyLength: 0,
        transcriptSnapshotSanitizedReplyLength: 0,
        transcriptSnapshotBuildAttempted: true,
        transcriptSnapshotBuildSkippedReason: 'assistant_reply_missing'
      },
      {
        transcriptSnapshotOutcome: 'skipped_unreviewable_transcript',
        transcriptSnapshotReason: 'transcript_unavailable',
        transcriptSnapshotAssistantReplyPresent: true,
        transcriptSnapshotAssistantReplyLength: 18,
        transcriptSnapshotSanitizedReplyLength: 0,
        transcriptSnapshotBuildAttempted: true,
        transcriptSnapshotBuildSkippedReason: 'sanitized_reply_empty'
      },
      {
        transcriptSnapshotOutcome: 'skipped_unreviewable_transcript',
        transcriptSnapshotReason: 'transcript_unavailable',
        transcriptSnapshotAssistantReplyPresent: true,
        transcriptSnapshotAssistantReplyLength: 32,
        transcriptSnapshotSanitizedReplyLength: 0,
        transcriptSnapshotBuildAttempted: true,
        transcriptSnapshotBuildSkippedReason: 'masking_removed_text'
      },
      {
        transcriptSnapshotOutcome: 'skipped_unreviewable_transcript',
        transcriptSnapshotReason: 'transcript_unavailable',
        transcriptSnapshotAssistantReplyPresent: true,
        transcriptSnapshotAssistantReplyLength: 28,
        transcriptSnapshotSanitizedReplyLength: 28,
        transcriptSnapshotBuildAttempted: true,
        transcriptSnapshotBuildSkippedReason: 'region_prompt_fallback'
      }
    ]
  });

  assert.equal(diagnostics.observedCount, 4);
  assert.equal(diagnostics.transcriptWriteOutcomeCounts.skipped_unreviewable_transcript, 4);
  assert.equal(diagnostics.snapshotInputDiagnostics.assistantReplyPresent.trueCount, 3);
  assert.equal(diagnostics.snapshotInputDiagnostics.assistantReplyPresent.falseCount, 1);
  assert.equal(diagnostics.snapshotInputDiagnostics.snapshotBuildAttempted.trueCount, 4);
  assert.equal(diagnostics.snapshotInputDiagnostics.snapshotBuildSkippedReason.assistant_reply_missing, 1);
  assert.equal(diagnostics.snapshotInputDiagnostics.snapshotBuildSkippedReason.sanitized_reply_empty, 1);
  assert.equal(diagnostics.snapshotInputDiagnostics.snapshotBuildSkippedReason.masking_removed_text, 1);
  assert.equal(diagnostics.snapshotInputDiagnostics.snapshotBuildSkippedReason.region_prompt_fallback, 1);
});
