'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

test('phase788: delivery records append recordEnvelope on write', async () => {
  const infraPath = require.resolve('../../src/infra/firestore');
  const repoPath = require.resolve('../../src/v1/evidence_ledger/deliveryRecordsRepo');
  const savedInfra = require.cache[infraPath];
  const savedRepo = require.cache[repoPath];
  const writes = [];
  const fakeDb = {
    collection: () => ({
      doc: (id) => ({
        id: id || 'delivery_phase788',
        async set(payload) {
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
    const result = await repo.appendDeliveryRecord({
      id: 'delivery_phase788',
      traceId: 'trace_phase788'
    });
    assert.equal(result.id, 'delivery_phase788');
    assert.equal(writes.length, 1);
    const row = writes[0];
    assert.ok(row.recordEnvelope && typeof row.recordEnvelope === 'object');
    assert.equal(row.recordEnvelope.record_id, 'delivery_phase788');
    assert.equal(row.recordEnvelope.record_type, 'delivery_record');
  } finally {
    if (savedInfra) require.cache[infraPath] = savedInfra;
    else delete require.cache[infraPath];
    if (savedRepo) require.cache[repoPath] = savedRepo;
    else delete require.cache[repoPath];
  }
});
