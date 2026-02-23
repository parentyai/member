'use strict';

const assert = require('node:assert/strict');
const { afterEach, beforeEach, test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const usersRepo = require('../../src/repos/firestore/usersRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const { getUserOperationalSummary } = require('../../src/usecases/admin/getUserOperationalSummary');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-01T00:00:00.000Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase633: users summary computes deliveryCount/clickCount/reactionRate additively', async () => {
  await usersRepo.createUser('U_PHASE633_1', {
    memberNumber: 'M-001',
    scenarioKey: 'A',
    stepKey: 'week',
    createdAt: new Date('2026-01-01T00:00:00.000Z')
  });
  await usersRepo.createUser('U_PHASE633_2', {
    memberNumber: null,
    scenarioKey: 'C',
    stepKey: 'after1w',
    createdAt: new Date('2026-01-01T00:00:00.000Z')
  });

  await deliveriesRepo.createDelivery({
    notificationId: 'N_PHASE633_1',
    lineUserId: 'U_PHASE633_1',
    sentAt: new Date('2026-01-02T00:00:00.000Z'),
    delivered: true
  });
  await deliveriesRepo.createDelivery({
    notificationId: 'N_PHASE633_2',
    lineUserId: 'U_PHASE633_1',
    sentAt: new Date('2026-01-03T00:00:00.000Z'),
    delivered: true,
    clickAt: new Date('2026-01-03T12:00:00.000Z')
  });
  await deliveriesRepo.createDelivery({
    notificationId: 'N_PHASE633_3',
    lineUserId: 'U_PHASE633_1',
    sentAt: new Date('2026-01-04T00:00:00.000Z'),
    delivered: true
  });

  const items = await getUserOperationalSummary({
    analyticsLimit: 2000,
    useSnapshot: false
  });

  const u1 = items.find((row) => row.lineUserId === 'U_PHASE633_1');
  const u2 = items.find((row) => row.lineUserId === 'U_PHASE633_2');

  assert.ok(u1);
  assert.ok(u2);

  assert.strictEqual(u1.memberNumber, 'M-001');
  assert.strictEqual(u1.scenarioKey, 'A');
  assert.strictEqual(u1.stepKey, 'week');
  assert.strictEqual(u1.deliveryCount, 3);
  assert.strictEqual(u1.clickCount, 1);
  assert.strictEqual(u1.reactionRate, 0.3333);

  assert.strictEqual(u2.deliveryCount, 0);
  assert.strictEqual(u2.clickCount, 0);
  assert.strictEqual(u2.reactionRate, null);
});
