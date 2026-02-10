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
  assert.strictEqual(servicePhase, null);
  assert.strictEqual(preset, null);
});

test('phase160: servicePhase/preset setters validate and persist', async () => {
  await systemFlagsRepo.setServicePhase(2);
  await systemFlagsRepo.setNotificationPreset('b');
  assert.strictEqual(await systemFlagsRepo.getServicePhase(), 2);
  assert.strictEqual(await systemFlagsRepo.getNotificationPreset(), 'B');

  await assert.rejects(() => systemFlagsRepo.setServicePhase(0));
  await assert.rejects(() => systemFlagsRepo.setServicePhase(99));
  await assert.rejects(() => systemFlagsRepo.setServicePhase('x'));
  await assert.rejects(() => systemFlagsRepo.setNotificationPreset('Z'));
});

