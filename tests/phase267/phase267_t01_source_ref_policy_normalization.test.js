'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const sourceRefsRepo = require('../../src/repos/firestore/sourceRefsRepo');

test('phase267: source ref policy fields are normalized and persisted', async () => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  try {
    const created = await sourceRefsRepo.createSourceRef({
      id: 'sr_policy_267',
      url: 'https://example.com/source-policy',
      status: 'active',
      sourceType: 'unknown_type',
      requiredLevel: 'maybe'
    });

    const before = await sourceRefsRepo.getSourceRef(created.id);
    assert.strictEqual(before.sourceType, 'other');
    assert.strictEqual(before.requiredLevel, 'required');

    const patch = sourceRefsRepo.normalizeSourcePolicyPatch({
      sourceType: 'community',
      requiredLevel: 'optional'
    });
    await sourceRefsRepo.updateSourceRef(created.id, patch);

    const after = await sourceRefsRepo.getSourceRef(created.id);
    assert.strictEqual(after.sourceType, 'community');
    assert.strictEqual(after.requiredLevel, 'optional');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
