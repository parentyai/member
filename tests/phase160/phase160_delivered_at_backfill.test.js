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
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');

test('phase160: deliveredAt backfill summary + apply', async (t) => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  await deliveriesRepo.createDeliveryWithId('d_fixable', {
    notificationId: 'n1',
    lineUserId: 'U1',
    delivered: true,
    state: 'delivered',
    sentAt: '2026-02-11T00:00:00.000Z',
    deliveredAt: null
  });
  await deliveriesRepo.createDeliveryWithId('d_already_ok', {
    notificationId: 'n2',
    lineUserId: 'U1',
    delivered: true,
    state: 'delivered',
    sentAt: '2026-02-11T00:00:01.000Z',
    deliveredAt: '2026-02-11T00:00:01.000Z'
  });
  await deliveriesRepo.createDeliveryWithId('d_unfixable', {
    notificationId: 'n3',
    lineUserId: 'U2',
    delivered: true,
    state: 'reserved',
    sentAt: null,
    deliveredAt: null
  });
  await deliveriesRepo.createDeliveryWithId('d_not_delivered', {
    notificationId: 'n4',
    lineUserId: 'U3',
    delivered: false,
    state: 'failed',
    sentAt: null,
    deliveredAt: null
  });

  const summary = await deliveriesRepo.getDeliveredAtBackfillSummary(5);
  assert.strictEqual(summary.deliveredCount, 3);
  assert.strictEqual(summary.missingDeliveredAtCount, 2);
  assert.strictEqual(summary.fixableCount, 1);
  assert.strictEqual(summary.unfixableCount, 1);
  assert.strictEqual(summary.candidates.length, 1);
  assert.strictEqual(summary.candidates[0].deliveryId, 'd_fixable');
  assert.strictEqual(summary.candidates[0].sentAtIso, '2026-02-11T00:00:00.000Z');

  const result = await deliveriesRepo.applyDeliveredAtBackfill(summary.candidates, {
    actor: 'admin_master',
    backfilledAt: '2026-02-11T12:00:00.000Z'
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.updatedCount, 1);
  assert.deepStrictEqual(result.updatedIds, ['d_fixable']);

  const fixed = await deliveriesRepo.getDelivery('d_fixable');
  assert.strictEqual(fixed.deliveredAt, '2026-02-11T00:00:00.000Z');
  assert.strictEqual(fixed.deliveredAtBackfilledAt, '2026-02-11T12:00:00.000Z');
  assert.strictEqual(fixed.deliveredAtBackfilledBy, 'admin_master');

  const after = await deliveriesRepo.getDeliveredAtBackfillSummary(5);
  assert.strictEqual(after.missingDeliveredAtCount, 1);
  assert.strictEqual(after.fixableCount, 0);
  assert.strictEqual(after.unfixableCount, 1);
});

