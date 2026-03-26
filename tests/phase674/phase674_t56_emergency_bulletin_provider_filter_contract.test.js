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
const emergencyBulletinsRepo = require('../../src/repos/firestore/emergencyBulletinsRepo');

test('phase674: emergency bulletin listing respects providerKey without adding index-only behavior', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    await emergencyBulletinsRepo.createBulletin({
      id: 'emb_674_provider_weather',
      status: 'draft',
      providerKey: 'nws_alerts',
      regionKey: 'ny::new-york',
      severity: 'WARN',
      headline: 'Weather bulletin'
    });
    await emergencyBulletinsRepo.createBulletin({
      id: 'emb_674_provider_recall',
      status: 'draft',
      providerKey: 'openfda_recalls',
      regionKey: 'NY::new-york',
      severity: 'CRITICAL',
      headline: 'Recall bulletin'
    });

    const weatherOnly = await emergencyBulletinsRepo.listBulletins({
      status: 'draft',
      regionKey: 'NY::new-york',
      providerKey: 'nws_alerts',
      limit: 20
    });
    const recallOnly = await emergencyBulletinsRepo.listBulletins({
      providerKey: 'openfda_recalls',
      limit: 20
    });

    assert.deepStrictEqual(weatherOnly.map((row) => row.id), ['emb_674_provider_weather']);
    assert.deepStrictEqual(recallOnly.map((row) => row.id), ['emb_674_provider_recall']);
    assert.equal(weatherOnly[0].providerKey, 'nws_alerts');
    assert.equal(recallOnly[0].providerKey, 'openfda_recalls');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
