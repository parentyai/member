'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

test('phase785: sourceRefsRepo writes and updates recordEnvelope for source refs', async () => {
  const infraPath = require.resolve('../../src/infra/firestore');
  const repoPath = require.resolve('../../src/repos/firestore/sourceRefsRepo');
  const savedInfra = require.cache[infraPath];
  const savedRepo = require.cache[repoPath];

  const docs = new Map();
  const fakeDb = {
    collection: () => ({
      doc: (id) => {
        const docId = id || `doc_${docs.size + 1}`;
        return {
          id: docId,
          async set(payload, options) {
            const current = docs.get(docId) || {};
            if (options && options.merge) {
              docs.set(docId, Object.assign({}, current, payload));
              return;
            }
            docs.set(docId, Object.assign({}, payload));
          },
          async get() {
            const row = docs.get(docId);
            return {
              id: docId,
              exists: Boolean(row),
              data: () => row
            };
          }
        };
      }
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

    await repo.createSourceRef({
      id: 'sr_phase785',
      url: 'https://example.gov/source',
      sourceType: 'official',
      requiredLevel: 'required',
      authorityLevel: 'federal'
    });
    const created = docs.get('sr_phase785');
    assert.ok(created.recordEnvelope && typeof created.recordEnvelope === 'object');
    assert.equal(created.recordEnvelope.record_id, 'sr_phase785');
    assert.equal(created.recordEnvelope.record_type, 'source_ref');
    assert.equal(created.recordEnvelope.authority_tier, 'T1_OFFICIAL_OPERATION');
    assert.equal(created.recordEnvelope.binding_level, 'POLICY');

    await repo.updateSourceRef('sr_phase785', { status: 'needs_review', sourceType: 'community' });
    const updated = docs.get('sr_phase785');
    assert.ok(updated.recordEnvelope && typeof updated.recordEnvelope === 'object');
    assert.equal(updated.recordEnvelope.record_id, 'sr_phase785');
    assert.equal(updated.recordEnvelope.record_type, 'source_ref');
    assert.equal(updated.recordEnvelope.authority_tier, 'T4_COMMUNITY');
  } finally {
    if (savedInfra) require.cache[infraPath] = savedInfra;
    else delete require.cache[infraPath];
    if (savedRepo) require.cache[repoPath] = savedRepo;
    else delete require.cache[repoPath];
  }
});
