'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

test('phase792: sourceRefsRepo writes lifecycle state/bucket and enforces transitions', async () => {
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
      id: 'sr_phase792',
      url: 'https://example.gov/source',
      status: 'needs_review',
      sourceType: 'semi_official'
    });
    const created = docs.get('sr_phase792');
    assert.equal(created.knowledgeLifecycleState, 'candidate');
    assert.equal(created.knowledgeLifecycleBucket, 'candidate_knowledge');

    await repo.updateSourceRef('sr_phase792', { status: 'active' });
    const approved = docs.get('sr_phase792');
    assert.equal(approved.knowledgeLifecycleState, 'approved');
    assert.equal(approved.knowledgeLifecycleBucket, 'approved_knowledge');

    await repo.updateSourceRef('sr_phase792', { status: 'retired' });
    const deprecated = docs.get('sr_phase792');
    assert.equal(deprecated.knowledgeLifecycleState, 'deprecated');
    assert.equal(deprecated.knowledgeLifecycleBucket, 'candidate_knowledge');

    await assert.rejects(
      async () => repo.updateSourceRef('sr_phase792', { knowledgeLifecycleState: 'rejected' }),
      /transition blocked|KNOWLEDGE_LIFECYCLE_TRANSITION_BLOCKED/
    );
  } finally {
    if (savedInfra) require.cache[infraPath] = savedInfra;
    else delete require.cache[infraPath];
    if (savedRepo) require.cache[repoPath] = savedRepo;
    else delete require.cache[repoPath];
  }
});
