'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

test('phase788: liff synthetic events repo writes recordEnvelope', async () => {
  const infraPath = require.resolve('../../src/infra/firestore');
  const repoPath = require.resolve('../../src/repos/firestore/liffSyntheticEventsRepo');
  const savedInfra = require.cache[infraPath];
  const savedRepo = require.cache[repoPath];
  const docs = new Map();
  const fakeDb = {
    collection: () => ({
      doc: (id) => ({
        id,
        async set(payload, options) {
          const current = docs.get(id) || {};
          if (options && options.merge) {
            docs.set(id, Object.assign({}, current, payload));
            return;
          }
          docs.set(id, Object.assign({}, payload));
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
    await repo.appendLiffSyntheticEventRecord({
      webhookEventId: 'evt_phase788',
      traceId: 'trace_phase788',
      lineUserId: 'U_PHASE788',
      sourceType: 'user',
      processStatus: 202,
      processReason: 'accepted',
      createdAt: '2026-03-10T00:00:00.000Z'
    });
    const row = docs.get('evt_phase788');
    assert.ok(row);
    assert.ok(row.recordEnvelope && typeof row.recordEnvelope === 'object');
    assert.equal(row.recordEnvelope.record_id, 'evt_phase788');
    assert.equal(row.recordEnvelope.record_type, 'liff_synthetic_event');
    assert.equal(row.synthetic, true);
    assert.equal(row.origin, 'liff_silent_path');
  } finally {
    if (savedInfra) require.cache[infraPath] = savedInfra;
    else delete require.cache[infraPath];
    if (savedRepo) require.cache[repoPath] = savedRepo;
    else delete require.cache[repoPath];
  }
});
