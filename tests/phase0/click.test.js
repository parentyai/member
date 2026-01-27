'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('./firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const { recordClickAndRedirect } = require('../../src/usecases/track/recordClickAndRedirect');

let db;

beforeEach(() => {
  db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('recordClickAndRedirect: marks click and returns url', async () => {
  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
  const delivery = await deliveriesRepo.createDelivery({ notificationId: 'n1', lineUserId: 'U1' });
  const result = await recordClickAndRedirect({
    deliveryId: delivery.id,
    linkRegistryId: link.id,
    at: 'NOW'
  });

  assert.strictEqual(result.url, 'https://example.com');
  const stored = db._state.collections.notification_deliveries.docs[delivery.id];
  assert.strictEqual(stored.data.clickAt, 'NOW');
});

test('recordClickAndRedirect: blocks WARN link', async () => {
  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
  await linkRegistryRepo.setHealth(link.id, { checkedAt: 'now', statusCode: 500, state: 'WARN' });
  const delivery = await deliveriesRepo.createDelivery({ notificationId: 'n1', lineUserId: 'U1' });
  await assert.rejects(
    () => recordClickAndRedirect({ deliveryId: delivery.id, linkRegistryId: link.id }),
    /WARN/
  );
});
