'use strict';

const conversationReviewSnapshotsRepo = require('../../repos/firestore/conversationReviewSnapshotsRepo');
const {
  buildMaskedConversationReviewSnapshot
} = require('../../domain/qualityPatrol/transcriptMasking/buildMaskedConversationReviewSnapshot');

function resolveEnabled() {
  const raw = String(process.env.ENABLE_QUALITY_PATROL_TRANSCRIPT_SNAPSHOTS_V1 || '').trim().toLowerCase();
  if (!raw) return true;
  return !['0', 'false', 'off', 'no'].includes(raw);
}

async function appendConversationReviewSnapshot(params, deps) {
  if (!resolveEnabled()) {
    return { ok: false, skipped: true, reason: 'feature_flag_off' };
  }
  const payload = params && typeof params === 'object' ? params : {};
  const snapshot = buildMaskedConversationReviewSnapshot(payload);
  if (!snapshot.lineUserKey) {
    return { ok: false, skipped: true, reason: 'line_user_key_missing' };
  }
  if (snapshot.userMessageAvailable !== true && snapshot.assistantReplyAvailable !== true) {
    return { ok: false, skipped: true, reason: 'transcript_unavailable' };
  }
  const repo = deps && deps.conversationReviewSnapshotsRepo
    ? deps.conversationReviewSnapshotsRepo
    : conversationReviewSnapshotsRepo;
  const result = await repo.appendConversationReviewSnapshot(snapshot);
  return Object.assign({ ok: true, snapshot }, result);
}

module.exports = {
  appendConversationReviewSnapshot
};
