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
const { validateCityPackSources } = require('../../src/usecases/cityPack/validateCityPackSources');

test('phase267: optional source failures do not block city pack validation', async () => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  try {
    await sourceRefsRepo.createSourceRef({
      id: 'sr_optional_expired_267',
      url: 'https://example.com/optional-expired',
      status: 'active',
      requiredLevel: 'optional',
      validFrom: '2025-01-01T00:00:00.000Z',
      validUntil: '2025-01-02T00:00:00.000Z'
    });

    const result = await validateCityPackSources({
      sourceRefs: ['sr_optional_expired_267'],
      now: new Date('2026-01-01T00:00:00.000Z')
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.blocked, false);
    assert.strictEqual(result.blockedReasonCategory, null);
    assert.strictEqual(result.optionalInvalidSourceRefs.length, 1);
    assert.strictEqual(result.blockingInvalidSourceRefs.length, 0);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase267: required source failures still block city pack validation', async () => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  try {
    await sourceRefsRepo.createSourceRef({
      id: 'sr_required_expired_267',
      url: 'https://example.com/required-expired',
      status: 'active',
      requiredLevel: 'required',
      validFrom: '2025-01-01T00:00:00.000Z',
      validUntil: '2025-01-02T00:00:00.000Z'
    });

    const result = await validateCityPackSources({
      sourceRefs: ['sr_required_expired_267'],
      now: new Date('2026-01-01T00:00:00.000Z')
    });

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.blocked, true);
    assert.strictEqual(result.blockedReasonCategory, 'SOURCE_EXPIRED');
    assert.strictEqual(result.blockingInvalidSourceRefs.length, 1);
    assert.strictEqual(result.optionalInvalidSourceRefs.length, 0);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
