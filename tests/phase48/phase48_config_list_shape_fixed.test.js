'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const automationConfigRepo = require('../../src/repos/firestore/automationConfigRepo');
const { listAutomationConfigs } = require('../../src/usecases/phase48/listAutomationConfigs');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase48: automation config list shape fixed', async () => {
  await automationConfigRepo.upsertAutomationConfig({
    enabled: true,
    allowScenarios: ['ops'],
    allowSteps: ['step1'],
    allowNextActions: ['NO_ACTION']
  });

  const result = await listAutomationConfigs({ limit: 5 });
  assert.strictEqual(result.ok, true);
  assert.ok(Array.isArray(result.items));
  assert.strictEqual(result.items.length, 1);
  assert.strictEqual(result.items[0].enabled, true);
  assert.deepStrictEqual(result.items[0].allowNextActions, ['NO_ACTION']);
});
