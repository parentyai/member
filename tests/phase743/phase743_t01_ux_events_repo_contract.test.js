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
const uxEventsRepo = require('../../src/repos/firestore/uxEventsRepo');

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

test('phase743: uxEventsRepo stores notification_sent as bounded sidecar record', async () => {
  const result = await uxEventsRepo.appendUxEvent({
    eventType: 'notification_sent',
    deliveryId: 'd743_1',
    notificationId: 'n743_1',
    lineUserId: 'U743',
    notificationCategory: 'SEQUENCE_GUIDANCE',
    responseText: 'must_not_be_saved'
  });

  assert.equal(result.id, 'notification_sent__d743_1');
  assert.equal(result.idempotent, false);
  const stored = db._state.collections.ux_events.docs['notification_sent__d743_1'].data;
  assert.equal(stored.eventType, 'notification_sent');
  assert.equal(stored.deliveryId, 'd743_1');
  assert.equal(stored.notificationId, 'n743_1');
  assert.equal(stored.lineUserId, 'U743');
  assert.equal(stored.retentionDays, 35);
  assert.equal(Object.prototype.hasOwnProperty.call(stored, 'responseText'), false);
  assert.equal(stored.createdAt, 'SERVER_TIMESTAMP');
  assert.ok(typeof stored.expiresAt === 'string' && stored.expiresAt.length > 0);
});

test('phase743: uxEventsRepo uses idempotent key and does not overwrite existing row', async () => {
  await uxEventsRepo.appendUxEvent({
    eventType: 'notification_sent',
    deliveryId: 'd743_2',
    actor: 'first_actor',
    createdAt: '2026-03-07T00:00:00.000Z'
  });
  const second = await uxEventsRepo.appendUxEvent({
    eventType: 'notification_sent',
    deliveryId: 'd743_2',
    actor: 'second_actor',
    createdAt: '2026-03-07T01:00:00.000Z'
  });

  assert.equal(second.id, 'notification_sent__d743_2');
  assert.equal(second.idempotent, true);
  const stored = db._state.collections.ux_events.docs['notification_sent__d743_2'].data;
  assert.equal(stored.actor, 'first_actor');
  assert.equal(stored.createdAt, '2026-03-07T00:00:00.000Z');
});

test('phase743: uxEventsRepo validates reaction_received contract and excludes PII', async () => {
  const result = await uxEventsRepo.appendUxEvent({
    eventType: 'reaction_received',
    deliveryId: 'd743_3',
    action: 'OPEN',
    lineUserId: 'U743',
    responseText: 'secret'
  });

  assert.equal(result.id, 'reaction_received__d743_3__open');
  const stored = db._state.collections.ux_events.docs['reaction_received__d743_3__open'].data;
  assert.equal(stored.eventType, 'reaction_received');
  assert.equal(stored.action, 'open');
  assert.equal(Object.prototype.hasOwnProperty.call(stored, 'responseText'), false);

  await assert.rejects(
    () => uxEventsRepo.appendUxEvent({ eventType: 'reaction_received', deliveryId: 'd743_4' }),
    /action required/
  );
  await assert.rejects(
    () => uxEventsRepo.appendUxEvent({ eventType: 'invalid', deliveryId: 'd743_5' }),
    /invalid eventType/
  );
});
