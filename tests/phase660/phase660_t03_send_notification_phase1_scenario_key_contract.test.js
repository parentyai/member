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
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
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

test('phase660: sendNotificationPhase1 resolves scenarioKey and targets canonical + legacy recipients', async () => {
  const linkRegistryId = await seedLink();
  await usersRepo.createUser('U1', { scenarioKey: 'A', createdAt: '2026-02-20T00:00:00.000Z' });
  await usersRepo.createUser('U2', { scenario: 'A', createdAt: '2026-02-21T00:00:00.000Z' });
  await usersRepo.createUser('U3', { scenarioKey: 'B', createdAt: '2026-02-22T00:00:00.000Z' });

  const created = await createNotificationPhase1({
    scenario: 'A',
    step: '3mo',
    linkRegistryId,
    message: { title: 't', body: 'b', ctaText: 'c' }
  });

  const pushed = [];
  const result = await sendNotificationPhase1({
    notificationId: created.id,
    killSwitch: false,
    pushFn: async (lineUserId) => {
      pushed.push(lineUserId);
    }
  });

  const deliveriesU1 = await deliveriesRepo.listDeliveriesByUser('U1', 10);
  const deliveriesU2 = await deliveriesRepo.listDeliveriesByUser('U2', 10);
  const deliveriesU3 = await deliveriesRepo.listDeliveriesByUser('U3', 10);

  assert.strictEqual(result.deliveredCount, 2);
  assert.deepStrictEqual(pushed.sort(), ['U1', 'U2']);
  assert.strictEqual(deliveriesU1.length, 1);
  assert.strictEqual(deliveriesU2.length, 1);
  assert.strictEqual(deliveriesU3.length, 0);
});
