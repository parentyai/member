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

const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const { getNotificationReadModel } = require('../../src/usecases/admin/getNotificationReadModel');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase188B: waitRule values produce nextWaitDays', async () => {
  const cases = [
    { stepKey: '3mo', expected: -90 },
    { stepKey: '2mo', expected: -60 },
    { stepKey: '1mo', expected: -30 },
    { stepKey: 'week', expected: -7 },
    { stepKey: 'after1w', expected: 7 },
    { stepKey: 'after1mo', expected: 30 }
  ];

  for (const entry of cases) {
    await notificationsRepo.createNotification({
      title: `Title ${entry.stepKey}`,
      scenarioKey: 'A',
      stepKey: entry.stepKey
    });
  }

  await notificationsRepo.createNotification({
    title: 'Title custom',
    scenarioKey: 'A',
    stepKey: 'custom'
  });

  const items = await getNotificationReadModel({ limit: 20 });
  const byStep = new Map();
  for (const item of items) {
    byStep.set(item.stepKey, item);
  }

  for (const entry of cases) {
    const item = byStep.get(entry.stepKey);
    assert.ok(item, `missing stepKey: ${entry.stepKey}`);
    assert.strictEqual(item.waitRuleType, 'TYPE_B');
    assert.strictEqual(item.waitRuleConfigured, true);
    assert.strictEqual(item.nextWaitDays, entry.expected);
    assert.strictEqual(item.nextWaitDaysSource, 'ssot_value');
  }

  const custom = byStep.get('custom');
  assert.ok(custom, 'missing stepKey: custom');
  assert.strictEqual(custom.waitRuleType, null);
  assert.strictEqual(custom.waitRuleConfigured, false);
  assert.strictEqual(custom.nextWaitDays, null);
  assert.strictEqual(custom.nextWaitDaysSource, 'ssot_unset');
});
