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

test('phase373: source policy patch supports authorityLevel and keeps backward compatibility', async () => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  try {
    await sourceRefsRepo.createSourceRef({
      id: 'sr_phase373_policy',
      url: 'https://example.com/phase373/source',
      status: 'active',
      sourceType: 'official',
      requiredLevel: 'required',
      authorityLevel: 'federal'
    });

    const backwardPatch = sourceRefsRepo.normalizeSourcePolicyPatch({
      sourceType: 'semi_official',
      requiredLevel: 'optional'
    });
    assert.strictEqual(Object.prototype.hasOwnProperty.call(backwardPatch, 'authorityLevel'), false);
    await sourceRefsRepo.updateSourceRef('sr_phase373_policy', backwardPatch);
    const rowAfterBackward = await sourceRefsRepo.getSourceRef('sr_phase373_policy');
    assert.strictEqual(rowAfterBackward.authorityLevel, 'federal');

    const authorityPatch = sourceRefsRepo.normalizeSourcePolicyPatch({
      sourceType: 'official',
      requiredLevel: 'required',
      authorityLevel: 'state'
    });
    assert.strictEqual(authorityPatch.authorityLevel, 'state');
    await sourceRefsRepo.updateSourceRef('sr_phase373_policy', authorityPatch);
    const rowAfterAuthority = await sourceRefsRepo.getSourceRef('sr_phase373_policy');
    assert.strictEqual(rowAfterAuthority.authorityLevel, 'state');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
