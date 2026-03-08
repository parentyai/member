'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { sanitizeFaqAuditPayload } = require('../../src/domain/audit/faqAuditPayloadGuard');

test('phase748: faq audit payload guard drops blocked and unknown keys', () => {
  const sanitized = sanitizeFaqAuditPayload({
    traceId: 'trace_phase748_guard',
    questionHash: 'qhash',
    locale: 'ja-JP',
    blockedReason: null,
    fullReplyText: 'drop_me',
    rawPrompt: 'drop_me',
    rawKbBodies: ['drop'],
    fullRequestBody: { drop: true },
    unknownField: 'drop'
  });

  assert.equal(sanitized.traceId, 'trace_phase748_guard');
  assert.equal(sanitized.questionHash, 'qhash');
  assert.equal(sanitized.locale, 'ja-JP');
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'fullReplyText'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'rawPrompt'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'rawKbBodies'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'fullRequestBody'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'unknownField'), false);
  assert.ok(Number.isFinite(Number(sanitized._droppedKeyCount)));
  assert.ok(Array.isArray(sanitized._droppedKeysSample));
  assert.ok(sanitized._droppedKeyCount >= 5);
});

test('phase748: faqAnswerLogsRepo applies sink guard before write', async () => {
  const infraPath = require.resolve('../../src/infra/firestore');
  const repoPath = require.resolve('../../src/repos/firestore/faqAnswerLogsRepo');
  const savedInfra = require.cache[infraPath];
  const savedRepo = require.cache[repoPath];

  const writes = [];
  const fakeDb = {
    collection: () => ({
      doc: () => ({
        id: 'faq_log_1',
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

    const result = await repo.appendFaqAnswerLog({
      traceId: 'trace_phase748_repo',
      questionHash: 'hash_1',
      matchedArticleIds: ['faq-1'],
      fullReplyText: 'must_drop',
      rawPrompt: 'must_drop',
      unknownField: 'drop'
    });

    assert.equal(result.id, 'faq_log_1');
    assert.equal(writes.length, 1);
    const row = writes[0];
    assert.equal(row.traceId, 'trace_phase748_repo');
    assert.equal(row.questionHash, 'hash_1');
    assert.deepEqual(row.matchedArticleIds, ['faq-1']);
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'fullReplyText'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'rawPrompt'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'unknownField'), false);
    assert.ok(Number.isFinite(Number(row._droppedKeyCount)));
    assert.ok(Array.isArray(row._droppedKeysSample));
    assert.equal(row.createdAt, 'SERVER_TS');
  } finally {
    if (savedInfra) require.cache[infraPath] = savedInfra;
    else delete require.cache[infraPath];
    if (savedRepo) require.cache[repoPath] = savedRepo;
    else delete require.cache[repoPath];
  }
});
