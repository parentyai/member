'use strict';

const assert = require('node:assert/strict');
const { beforeEach, afterEach, test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { createNotification } = require('../../src/usecases/notifications/createNotification');
const { sendNotification } = require('../../src/usecases/notifications/sendNotification');
const usersRepo = require('../../src/repos/firestore/usersRepo');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const { computeNotificationDeliveryId } = require('../../src/domain/deliveryId');

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

test('phase743: sendNotification appends ux_event(notification_sent) when flag is enabled', async () => {
  const previous = process.env.ENABLE_UXOS_EVENTS_V1;
  process.env.ENABLE_UXOS_EVENTS_V1 = '1';
  try {
    const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
    const created = await createNotification({
      title: 'Title',
      body: 'Body',
      ctaText: 'Go',
      linkRegistryId: link.id,
      scenarioKey: 'A',
      stepKey: '3mo',
      notificationCategory: 'SEQUENCE_GUIDANCE',
      target: { all: true }
    });
    await usersRepo.createUser('U743_SN', { scenarioKey: 'A', stepKey: '3mo' });

    const result = await sendNotification({
      notificationId: created.id,
      sentAt: '2026-03-07T10:00:00.000Z',
      killSwitch: false,
      pushFn: async () => ({ status: 200 })
    });

    assert.equal(result.deliveredCount, 1);
    const deliveryId = computeNotificationDeliveryId({ notificationId: created.id, lineUserId: 'U743_SN' });
    const eventId = `notification_sent__${deliveryId}`;
    const stored = db._state.collections.ux_events.docs[eventId].data;
    assert.equal(stored.eventType, 'notification_sent');
    assert.equal(stored.deliveryId, deliveryId);
    assert.equal(stored.lineUserId, 'U743_SN');
    assert.equal(stored.notificationCategory, 'SEQUENCE_GUIDANCE');
    assert.equal(Object.prototype.hasOwnProperty.call(stored, 'responseText'), false);
  } finally {
    if (previous === undefined) delete process.env.ENABLE_UXOS_EVENTS_V1;
    else process.env.ENABLE_UXOS_EVENTS_V1 = previous;
  }
});

test('phase743: sendNotification keeps main flow when appendUxEvent fails (best-effort)', async () => {
  const previous = process.env.ENABLE_UXOS_EVENTS_V1;
  process.env.ENABLE_UXOS_EVENTS_V1 = '1';
  try {
    const link = await linkRegistryRepo.createLink({ title: 't2', url: 'https://example.com/2' });
    const created = await createNotification({
      title: 'Title 2',
      body: 'Body 2',
      ctaText: 'Go 2',
      linkRegistryId: link.id,
      scenarioKey: 'A',
      stepKey: '3mo',
      target: { all: true }
    });
    await usersRepo.createUser('U743_SN_2', { scenarioKey: 'A', stepKey: '3mo' });

    const result = await sendNotification({
      notificationId: created.id,
      sentAt: '2026-03-07T11:00:00.000Z',
      killSwitch: false,
      pushFn: async () => ({ status: 200 }),
      appendUxEventFn: async () => {
        throw new Error('ux event unavailable');
      }
    });

    assert.equal(result.deliveredCount, 1);
    assert.equal(result.notificationId, created.id);
  } finally {
    if (previous === undefined) delete process.env.ENABLE_UXOS_EVENTS_V1;
    else process.env.ENABLE_UXOS_EVENTS_V1 = previous;
  }
});
