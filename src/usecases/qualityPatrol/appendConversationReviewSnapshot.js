'use strict';

const conversationReviewSnapshotsRepo = require('../../repos/firestore/conversationReviewSnapshotsRepo');
const {
  buildMaskedConversationReviewSnapshot
} = require('../../domain/qualityPatrol/transcriptMasking/buildMaskedConversationReviewSnapshot');
const {
  normalizeTranscriptSnapshotOutcome
} = require('../../domain/qualityPatrol/transcript/buildTranscriptCoverageDiagnostics');

const TRANSCRIPT_SNAPSHOT_OUTCOME = Object.freeze({
  written: 'written',
  skippedFlagDisabled: 'skipped_flag_disabled',
  skippedMissingLineUserKey: 'skipped_missing_line_user_key',
  skippedUnreviewableTranscript: 'skipped_unreviewable_transcript',
  failedRepoWrite: 'failed_repo_write',
  failedUnknown: 'failed_unknown'
});

function resolveEnabled() {
  const raw = String(process.env.ENABLE_QUALITY_PATROL_TRANSCRIPT_SNAPSHOTS_V1 || '').trim().toLowerCase();
  if (!raw) return true;
  return !['0', 'false', 'off', 'no'].includes(raw);
}

function buildOutcomeEnvelope(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const outcome = normalizeTranscriptSnapshotOutcome(payload.outcome) || TRANSCRIPT_SNAPSHOT_OUTCOME.failedUnknown;
  const snapshot = payload.snapshot && typeof payload.snapshot === 'object' ? payload.snapshot : null;
  return {
    ok: payload.ok === true,
    written: outcome === TRANSCRIPT_SNAPSHOT_OUTCOME.written,
    skipped: outcome.startsWith('skipped_'),
    failed: outcome.startsWith('failed_'),
    outcome,
    reason: typeof payload.reason === 'string' ? payload.reason : null,
    snapshot,
    transcriptSnapshotLineUserKeyAvailable: snapshot ? Boolean(snapshot.lineUserKey) : false,
    transcriptSnapshotUserMessageAvailable: snapshot ? snapshot.userMessageAvailable === true : false,
    transcriptSnapshotAssistantReplyAvailable: snapshot ? snapshot.assistantReplyAvailable === true : false,
    transcriptSnapshotPriorContextSummaryAvailable: snapshot ? snapshot.priorContextSummaryAvailable === true : false
  };
}

async function appendConversationReviewSnapshot(params, deps) {
  try {
    if (!resolveEnabled()) {
      return buildOutcomeEnvelope({
        ok: false,
        outcome: TRANSCRIPT_SNAPSHOT_OUTCOME.skippedFlagDisabled,
        reason: 'feature_flag_off'
      });
    }
    const payload = params && typeof params === 'object' ? params : {};
    const snapshot = buildMaskedConversationReviewSnapshot(payload);
    if (!snapshot.lineUserKey) {
      return buildOutcomeEnvelope({
        ok: false,
        outcome: TRANSCRIPT_SNAPSHOT_OUTCOME.skippedMissingLineUserKey,
        reason: 'line_user_key_missing',
        snapshot
      });
    }
    if (snapshot.userMessageAvailable !== true && snapshot.assistantReplyAvailable !== true) {
      return buildOutcomeEnvelope({
        ok: false,
        outcome: TRANSCRIPT_SNAPSHOT_OUTCOME.skippedUnreviewableTranscript,
        reason: 'transcript_unavailable',
        snapshot
      });
    }
    const repo = deps && deps.conversationReviewSnapshotsRepo
      ? deps.conversationReviewSnapshotsRepo
      : conversationReviewSnapshotsRepo;
    try {
      const result = await repo.appendConversationReviewSnapshot(snapshot);
      return Object.assign(
        buildOutcomeEnvelope({
          ok: true,
          outcome: TRANSCRIPT_SNAPSHOT_OUTCOME.written,
          reason: null,
          snapshot
        }),
        result
      );
    } catch (error) {
      return Object.assign(
        buildOutcomeEnvelope({
          ok: false,
          outcome: TRANSCRIPT_SNAPSHOT_OUTCOME.failedRepoWrite,
          reason: 'repo_write_failed',
          snapshot
        }),
        {
          error: {
            code: typeof error.code === 'string' && error.code.trim() ? error.code.trim() : 'repo_write_failed',
            message: typeof error.message === 'string' && error.message.trim() ? error.message.trim() : 'conversation review snapshot repo write failed'
          }
        }
      );
    }
  } catch (error) {
    return Object.assign(
      buildOutcomeEnvelope({
        ok: false,
        outcome: TRANSCRIPT_SNAPSHOT_OUTCOME.failedUnknown,
        reason: 'unknown_snapshot_error'
      }),
      {
        error: {
          code: typeof error.code === 'string' && error.code.trim() ? error.code.trim() : 'unknown_snapshot_error',
          message: typeof error.message === 'string' && error.message.trim() ? error.message.trim() : 'conversation review snapshot append failed'
        }
      }
    );
  }
}

module.exports = {
  TRANSCRIPT_SNAPSHOT_OUTCOME,
  appendConversationReviewSnapshot
};
