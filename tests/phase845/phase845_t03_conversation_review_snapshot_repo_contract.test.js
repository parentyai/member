'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

test('phase845: conversationReviewSnapshotsRepo writes masked row with retention metadata', async () => {
  const infraPath = require.resolve('../../src/infra/firestore');
  const repoPath = require.resolve('../../src/repos/firestore/conversationReviewSnapshotsRepo');
  const savedInfra = require.cache[infraPath];
  const savedRepo = require.cache[repoPath];

  const writes = [];
  const fakeDb = {
    collection: () => ({
      doc: () => ({
        id: 'conversation_review_snapshot_1',
        set: async (payload) => {
          writes.push(payload);
        }
      })
    })
  };

  try {
    require.cache[infraPath] = {
      id: infraPath,
      filename: infraPath,
      loaded: true,
      exports: {
        getDb: () => fakeDb,
        serverTimestamp: () => 'SERVER_TS'
      }
    };
    delete require.cache[repoPath];
    const repo = require(repoPath);

    const result = await repo.appendConversationReviewSnapshot({
      lineUserKey: 'userkey_phase845_repo_001',
      traceId: 'trace_phase845_repo',
      userMessageMasked: 'こんにちは',
      assistantReplyMasked: 'まずは次の一手を確認しましょう。',
      userMessageAvailable: true,
      assistantReplyAvailable: true,
      textPolicy: {
        userMessage: { originalLength: 5, storedLength: 5, truncated: false, replacements: [] },
        assistantReply: { originalLength: 16, storedLength: 16, truncated: false, replacements: [] },
        priorContextSummary: { originalLength: 0, storedLength: 0, truncated: false, replacements: [] }
      }
    });

    assert.equal(result.id, 'conversation_review_snapshot_1');
    assert.equal(writes.length, 1);
    const row = writes[0];
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'lineUserId'), false);
    assert.equal(row.lineUserKey, 'userkey_phase845_repo_001');
    assert.equal(row.createdAt, 'SERVER_TS');
    assert.ok(row.recordEnvelope && typeof row.recordEnvelope === 'object');
    assert.equal(row.recordEnvelope.record_type, 'conversation_review_snapshot');
    assert.equal(row.recordEnvelope.retention_tag, 'conversation_review_snapshots_180d');
    assert.equal(row.recordEnvelope.masking_policy, 'quality_patrol_transcript_masked_v1');
    assert.deepEqual(row.recordEnvelope.access_scope, ['operator', 'quality_patrol']);
  } finally {
    if (savedInfra) require.cache[infraPath] = savedInfra;
    else delete require.cache[infraPath];
    if (savedRepo) require.cache[repoPath] = savedRepo;
    else delete require.cache[repoPath];
  }
});
