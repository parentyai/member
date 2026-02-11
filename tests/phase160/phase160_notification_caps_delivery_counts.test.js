'use strict';

const assert = require('assert');
const { afterEach, beforeEach, test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest } = require('../../src/infra/firestore');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
});

afterEach(() => {
  clearDbForTest();
});

test('phase160: delivery count uses deliveredAt and falls back to legacy sentAt', async () => {
  await deliveriesRepo.createDeliveryWithId('d1', {
    lineUserId: 'U1',
    delivered: true,
    sentAt: '2026-02-10T00:00:00.000Z',
    deliveredAt: '2026-02-10T00:00:00.000Z',
    notificationCategory: 'DEADLINE_REQUIRED'
  });
  await deliveriesRepo.createDeliveryWithId('d2', {
    lineUserId: 'U1',
    delivered: true,
    sentAt: '2026-02-10T01:00:00.000Z',
    notificationCategory: 'DEADLINE_REQUIRED'
  });
  await deliveriesRepo.createDeliveryWithId('d3', {
    lineUserId: 'U1',
    delivered: true,
    sentAt: '2026-02-01T00:00:00.000Z',
    notificationCategory: 'DEADLINE_REQUIRED'
  });
  await deliveriesRepo.createDeliveryWithId('d4', {
    lineUserId: 'U1',
    delivered: false,
    sentAt: '2026-02-10T02:00:00.000Z',
    notificationCategory: 'DEADLINE_REQUIRED'
  });
  await deliveriesRepo.createDeliveryWithId('d5', {
    lineUserId: 'U2',
    delivered: true,
    sentAt: '2026-02-10T03:00:00.000Z',
    deliveredAt: '2026-02-10T03:00:00.000Z',
    notificationCategory: 'DEADLINE_REQUIRED'
  });

  const since = '2026-02-09T00:00:00.000Z';
  const byUser = await deliveriesRepo.countDeliveredByUserSince('U1', since);
  const byCategory = await deliveriesRepo.countDeliveredByUserCategorySince('U1', 'DEADLINE_REQUIRED', since);
  const byOtherCategory = await deliveriesRepo.countDeliveredByUserCategorySince('U1', 'IMMEDIATE_ACTION', since);

  assert.strictEqual(byUser, 2);
  assert.strictEqual(byCategory, 2);
  assert.strictEqual(byOtherCategory, 0);
});
