'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

test('phase785: faqAnswerLogsRepo appends universal record envelope on write', async () => {
  const infraPath = require.resolve('../../src/infra/firestore');
  const repoPath = require.resolve('../../src/repos/firestore/faqAnswerLogsRepo');
  const savedInfra = require.cache[infraPath];
  const savedRepo = require.cache[repoPath];

  const writes = [];
  const fakeDb = {
    collection: () => ({
      doc: () => ({
        id: 'faq_log_785',
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
      traceId: 'trace_phase785_faq',
      questionHash: 'qhash_785'
    });

    assert.equal(result.id, 'faq_log_785');
    assert.equal(writes.length, 1);
    const row = writes[0];
    assert.ok(row.recordEnvelope && typeof row.recordEnvelope === 'object');
    assert.equal(row.recordEnvelope.record_id, 'faq_log_785');
    assert.equal(row.recordEnvelope.record_type, 'faq_answer_log');
    assert.equal(row.recordEnvelope.source_system, 'member_firestore');
  } finally {
    if (savedInfra) require.cache[infraPath] = savedInfra;
    else delete require.cache[infraPath];
    if (savedRepo) require.cache[repoPath] = savedRepo;
    else delete require.cache[repoPath];
  }
});
