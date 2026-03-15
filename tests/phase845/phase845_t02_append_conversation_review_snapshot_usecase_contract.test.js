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
  assert.equal(result.id, 'review_snapshot_phase845');
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
  assert.equal(called, 0);
});
