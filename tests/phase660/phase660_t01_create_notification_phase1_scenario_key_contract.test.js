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

const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const { createNotificationPhase1 } = require('../../src/usecases/notifications/createNotificationPhase1');

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

test('phase660: createNotificationPhase1 normalizes legacy scenario to scenarioKey write', async () => {
  const linkRegistryId = await seedLink();
  const created = await createNotificationPhase1({
    scenario: 'A',
    step: '3mo',
    linkRegistryId,
    message: { title: 't', body: 'b', ctaText: 'c' }
  });

  const stored = await notificationsRepo.getNotification(created.id);
  assert.strictEqual(stored.scenarioKey, 'A');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(stored, 'scenario'), false);
});

test('phase660: createNotificationPhase1 prefers explicit scenarioKey over legacy scenario', async () => {
  const linkRegistryId = await seedLink();
  const created = await createNotificationPhase1({
    scenarioKey: 'B',
    scenario: 'A',
    step: '3mo',
    linkRegistryId,
    message: { title: 't', body: 'b', ctaText: 'c' }
  });

  const stored = await notificationsRepo.getNotification(created.id);
  assert.strictEqual(stored.scenarioKey, 'B');
});
