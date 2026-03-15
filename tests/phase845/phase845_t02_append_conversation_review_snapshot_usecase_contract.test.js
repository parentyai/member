'use strict';

const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const {
  appendConversationReviewSnapshot
} = require('../../src/usecases/qualityPatrol/appendConversationReviewSnapshot');

afterEach(() => {
  delete process.env.ENABLE_QUALITY_PATROL_TRANSCRIPT_SNAPSHOTS_V1;
});

test('phase845: appendConversationReviewSnapshot builds masked snapshot and appends through repo', async () => {
  const writes = [];
  const result = await appendConversationReviewSnapshot({
    lineUserId: 'U_PHASE845_USECASE',
    traceId: 'trace_phase845_usecase',
    routeKind: 'canonical',
    strategy: 'grounded_answer',
    userMessageText: '見積は foo@example.com に送ってください',
    assistantReplyText: 'URLは https://example.com を見てください',
    contextSnapshot: {
      phase: 'arrival',
      topTasks: [{ title: '申込', status: 'todo' }]
    }
  }, {
    conversationReviewSnapshotsRepo: {
      appendConversationReviewSnapshot: async (payload) => {
        writes.push(payload);
        return { id: 'review_snapshot_phase845' };
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.outcome, 'written');
  assert.equal(result.written, true);
  assert.equal(result.skipped, false);
  assert.equal(result.failed, false);
  assert.equal(result.id, 'review_snapshot_phase845');
  assert.equal(result.transcriptSnapshotBuildAttempted, true);
  assert.equal(result.transcriptSnapshotBuildSkippedReason, null);
  assert.equal(result.transcriptSnapshotAssistantReplyPresent, true);
  assert.equal(result.transcriptSnapshotAssistantReplyLength > 0, true);
  assert.equal(result.transcriptSnapshotSanitizedReplyLength > 0, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].userMessageMasked.includes('foo@example.com'), false);
  assert.match(writes[0].userMessageMasked, /\[email\]/);
  assert.match(writes[0].assistantReplyMasked, /\[url\]/);
  assert.equal(typeof writes[0].lineUserKey, 'string');
  assert.equal(writes[0].lineUserKey.length, 24);
});

test('phase845: appendConversationReviewSnapshot is disabled by rollback flag', async () => {
  process.env.ENABLE_QUALITY_PATROL_TRANSCRIPT_SNAPSHOTS_V1 = '0';
  let called = 0;
  const result = await appendConversationReviewSnapshot({
    lineUserId: 'U_PHASE845_DISABLED',
    userMessageText: 'こんにちは',
    assistantReplyText: 'こんにちは'
  }, {
    conversationReviewSnapshotsRepo: {
      appendConversationReviewSnapshot: async () => {
        called += 1;
        return { id: 'should_not_write' };
      }
    }
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'feature_flag_off');
  assert.equal(result.outcome, 'skipped_flag_disabled');
  assert.equal(result.transcriptSnapshotBuildAttempted, false);
  assert.equal(result.transcriptSnapshotBuildSkippedReason, 'feature_flag_off');
  assert.equal(called, 0);
});

test('phase845: appendConversationReviewSnapshot surfaces missing line user key as skip reason', async () => {
  const result = await appendConversationReviewSnapshot({
    lineUserId: '',
    userMessageText: 'こんにちは',
    assistantReplyText: 'まずは条件を整理しましょう'
  }, {
    conversationReviewSnapshotsRepo: {
      appendConversationReviewSnapshot: async () => {
        throw new Error('should_not_write');
      }
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.equal(result.outcome, 'skipped_missing_line_user_key');
  assert.equal(result.reason, 'line_user_key_missing');
  assert.equal(result.transcriptSnapshotBuildAttempted, true);
  assert.equal(result.transcriptSnapshotBuildSkippedReason, 'line_user_key_missing');
  assert.equal(result.transcriptSnapshotAssistantReplyPresent, true);
});

test('phase845: appendConversationReviewSnapshot keeps unreviewable transcript skipped after masking', async () => {
  const result = await appendConversationReviewSnapshot({
    lineUserId: 'U_PHASE845_UNREVIEWABLE',
    userMessageText: '   ',
    assistantReplyText: '\n\n'
  }, {
    conversationReviewSnapshotsRepo: {
      appendConversationReviewSnapshot: async () => {
        throw new Error('should_not_write');
      }
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.equal(result.outcome, 'skipped_unreviewable_transcript');
  assert.equal(result.reason, 'transcript_unavailable');
  assert.equal(result.transcriptSnapshotUserMessageAvailable, false);
  assert.equal(result.transcriptSnapshotAssistantReplyAvailable, false);
  assert.equal(result.transcriptSnapshotBuildAttempted, true);
  assert.equal(result.transcriptSnapshotBuildSkippedReason, 'assistant_reply_missing');
  assert.equal(result.transcriptSnapshotAssistantReplyPresent, false);
  assert.equal(result.transcriptSnapshotAssistantReplyLength, 0);
  assert.equal(result.transcriptSnapshotSanitizedReplyLength, 0);
});

test('phase845: appendConversationReviewSnapshot classifies repo write failure without throwing main flow', async () => {
  const result = await appendConversationReviewSnapshot({
    lineUserId: 'U_PHASE845_REPO_FAIL',
    userMessageText: '家賃補助の条件を教えてください',
    assistantReplyText: 'まずは勤務先の規定を確認しましょう'
  }, {
    conversationReviewSnapshotsRepo: {
      appendConversationReviewSnapshot: async () => {
        const error = new Error('firestore write denied');
        error.code = 'permission-denied';
        throw error;
      }
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.failed, true);
  assert.equal(result.outcome, 'failed_repo_write');
  assert.equal(result.reason, 'repo_write_failed');
  assert.equal(result.transcriptSnapshotBuildAttempted, true);
  assert.equal(result.transcriptSnapshotBuildSkippedReason, null);
  assert.equal(result.error.code, 'permission-denied');
  assert.match(result.error.message, /firestore write denied/);
});
