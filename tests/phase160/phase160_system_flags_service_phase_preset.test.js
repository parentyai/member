'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest } = require('../../src/infra/firestore');

const systemFlagsRepo = require('../../src/repos/firestore/systemFlagsRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
});

afterEach(() => {
  clearDbForTest();
});

test('phase160: servicePhase/preset getters return null when unset', async () => {
  const servicePhase = await systemFlagsRepo.getServicePhase();
  const preset = await systemFlagsRepo.getNotificationPreset();
  const notificationCaps = await systemFlagsRepo.getNotificationCaps();
  assert.strictEqual(servicePhase, null);
  assert.strictEqual(preset, null);
  assert.deepStrictEqual(notificationCaps, {
    perUserWeeklyCap: null,
    perUserDailyCap: null,
    perCategoryWeeklyCap: null,
    quietHours: null
  });
});

test('phase160: servicePhase/preset setters validate and persist', async () => {
  await systemFlagsRepo.setServicePhase(2);
  await systemFlagsRepo.setNotificationPreset('b');
  await systemFlagsRepo.setNotificationCaps({ perUserWeeklyCap: 3 });
  assert.strictEqual(await systemFlagsRepo.getServicePhase(), 2);
  assert.strictEqual(await systemFlagsRepo.getNotificationPreset(), 'B');
  assert.deepStrictEqual(await systemFlagsRepo.getNotificationCaps(), {
    perUserWeeklyCap: 3,
    perUserDailyCap: null,
    perCategoryWeeklyCap: null,
    quietHours: null
  });

  // Explicit null clears.
  await systemFlagsRepo.setServicePhase(null);
  await systemFlagsRepo.setNotificationPreset(null);
  await systemFlagsRepo.setNotificationCaps({ perUserWeeklyCap: null });
  assert.strictEqual(await systemFlagsRepo.getServicePhase(), null);
  assert.strictEqual(await systemFlagsRepo.getNotificationPreset(), null);
  assert.deepStrictEqual(await systemFlagsRepo.getNotificationCaps(), {
    perUserWeeklyCap: null,
    perUserDailyCap: null,
    perCategoryWeeklyCap: null,
    quietHours: null
  });

  await assert.rejects(() => systemFlagsRepo.setServicePhase(0));
  await assert.rejects(() => systemFlagsRepo.setServicePhase(99));
  await assert.rejects(() => systemFlagsRepo.setServicePhase('x'));
  await assert.rejects(() => systemFlagsRepo.setNotificationPreset('Z'));
  await assert.rejects(() => systemFlagsRepo.setNotificationCaps({ perUserWeeklyCap: 0 }));
  await assert.rejects(() => systemFlagsRepo.setNotificationCaps({ perUserWeeklyCap: 1000 }));
});
