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

const usersRepo = require('../../src/repos/firestore/usersRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const { createNotificationPhase1 } = require('../../src/usecases/notifications/createNotificationPhase1');
const { sendNotificationPhase1 } = require('../../src/usecases/notifications/sendNotificationPhase1');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

async function seedLink() {
  const created = await linkRegistryRepo.createLink({
    title: 'Link',
    url: 'https://example.com',
    lastHealth: { state: 'OK' }
  });
  return created.id;
}

test('admin notifications: scenario only targeting (step ignored)', async () => {
  const linkRegistryId = await seedLink();
  await usersRepo.createUser('U1', { scenario: 'A', step: '1mo' });
  await usersRepo.createUser('U2', { scenario: 'B', step: '3mo' });

  const created = await createNotificationPhase1({
    scenario: 'A',
    step: '3mo',
    linkRegistryId,
    message: { title: 't', body: 'b', ctaText: 'c' }
  });

  const result = await sendNotificationPhase1({
    notificationId: created.id,
    killSwitch: false,
    pushFn: async () => {}
  });

  const deliveriesU1 = await deliveriesRepo.listDeliveriesByUser('U1', 10);
  const deliveriesU2 = await deliveriesRepo.listDeliveriesByUser('U2', 10);

  assert.strictEqual(result.deliveredCount, 1);
  assert.strictEqual(deliveriesU1.length, 1);
  assert.strictEqual(deliveriesU2.length, 0);
});

test('admin notifications: linkRegistryId required', async () => {
  await assert.rejects(() => createNotificationPhase1({
    scenario: 'A',
    step: '3mo',
    message: { title: 't', body: 'b', ctaText: 'c' }
  }));
});

test('admin notifications: events best-effort does not block', async () => {
  const linkRegistryId = await seedLink();
  await usersRepo.createUser('U1', { scenario: 'A' });

  const created = await createNotificationPhase1({
    scenario: 'A',
    step: '3mo',
    linkRegistryId,
    message: { title: 't', body: 'b', ctaText: 'c' }
  });

  const result = await sendNotificationPhase1({
    notificationId: created.id,
    killSwitch: false,
    pushFn: async () => {},
    eventLogger: async () => {
      throw new Error('event failed');
    }
  });

  assert.strictEqual(result.deliveredCount, 1);
});
