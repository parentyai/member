'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { normalizeScenarioKey, detectScenarioDrift } = require('../../src/domain/normalizers/scenarioKeyNormalizer');
const usersRepo = require('../../src/repos/firestore/usersRepo');
const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

test('phase307: normalizeScenarioKey absorbs scenario/scenarioKey drift', () => {
  assert.strictEqual(normalizeScenarioKey({ scenarioKey: 'A', scenario: 'B' }), 'A');
  assert.strictEqual(normalizeScenarioKey({ scenario: 'B' }), 'B');
  assert.strictEqual(normalizeScenarioKey({ scenarioKey: '  C  ' }), 'C');
  assert.strictEqual(normalizeScenarioKey({}), null);

  assert.strictEqual(detectScenarioDrift({ scenarioKey: 'A', scenario: 'B' }), true);
  assert.strictEqual(detectScenarioDrift({ scenarioKey: 'A', scenario: 'A' }), false);
  assert.strictEqual(detectScenarioDrift({ scenario: 'A' }), false);
});

test('phase307: usersRepo.listUsers accepts legacy scenario input and queries canonical scenarioKey', async (t) => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  await usersRepo.createUser('U_SCENARIO_A', {
    scenarioKey: 'A',
    stepKey: 'week',
    createdAt: '2026-01-01T00:00:00.000Z'
  });
  await usersRepo.createUser('U_SCENARIO_B', {
    scenarioKey: 'B',
    stepKey: 'week',
    createdAt: '2026-01-02T00:00:00.000Z'
  });

  const rows = await usersRepo.listUsers({ scenario: 'A', limit: 10 });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].id, 'U_SCENARIO_A');
});
