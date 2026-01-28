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
const checklistsRepo = require('../../src/repos/firestore/checklistsRepo');
const userChecklistsRepo = require('../../src/repos/firestore/userChecklistsRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const { createNotificationPhase1 } = require('../../src/usecases/notifications/createNotificationPhase1');
const { sendNotificationPhase1 } = require('../../src/usecases/notifications/sendNotificationPhase1');
const { getChecklistWithStatus } = require('../../src/usecases/checklists/getChecklistWithStatus');
const { toggleChecklistItem } = require('../../src/usecases/checklists/toggleChecklistItem');
const { logEventBestEffort } = require('../../src/usecases/events/logEvent');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase1 smoke: notify -> delivery -> checklist -> events', async () => {
  const link = await linkRegistryRepo.createLink({
    title: 'Link',
    url: 'https://example.com',
    lastHealth: { state: 'OK' }
  });

  await usersRepo.createUser('U1', { scenario: 'A' });

  const checklist = await checklistsRepo.createChecklist({
    scenario: 'A',
    step: '3mo',
    items: [{ itemId: 'i1', title: 't1', linkRegistryId: link.id, order: 1 }]
  });

  const notification = await createNotificationPhase1({
    scenario: 'A',
    step: '3mo',
    linkRegistryId: link.id,
    message: { title: 't', body: 'b', ctaText: 'c' }
  });

  const sendResult = await sendNotificationPhase1({
    notificationId: notification.id,
    killSwitch: false,
    pushFn: async () => {}
  });
  assert.strictEqual(sendResult.deliveredCount, 1);

  const deliveries = await deliveriesRepo.listDeliveriesByUser('U1', 10);
  assert.strictEqual(deliveries.length, 1);

  const checklistStatus = await getChecklistWithStatus({ lineUserId: 'U1', step: '3mo' });
  assert.strictEqual(checklistStatus.items.length, 1);

  await toggleChecklistItem({
    lineUserId: 'U1',
    checklistId: checklist.id,
    itemId: 'i1',
    complete: true
  });
  const stored = await userChecklistsRepo.getUserChecklist('U1', checklist.id, 'i1');
  assert.strictEqual(stored.completedAt, 'SERVER_TIMESTAMP');

  const open = await logEventBestEffort({
    lineUserId: 'U1',
    type: 'open',
    ref: { notificationId: notification.id }
  });
  assert.strictEqual(open.ok, true);

  const click = await logEventBestEffort({
    lineUserId: 'U1',
    type: 'click',
    ref: { notificationId: notification.id }
  });
  assert.strictEqual(click.ok, true);

  const complete = await logEventBestEffort({
    lineUserId: 'U1',
    type: 'complete',
    ref: { checklistId: checklist.id, itemId: 'i1' }
  });
  assert.strictEqual(complete.ok, true);
});
