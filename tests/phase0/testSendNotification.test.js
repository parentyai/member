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
const { testSendNotification } = require('../../src/usecases/notifications/testSendNotification');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('testSendNotification: creates delivery after push', async () => {
  const result = await testSendNotification({
    lineUserId: 'U1',
    text: 'hello',
    killSwitch: false,
    pushFn: async () => ({ status: 200 })
  });

  assert.ok(result.id);

  // verify delivery stored
  const db = require('../../src/infra/firestore').getDb();
  const snap = await db.collection('notification_deliveries').doc(result.id).get();
  assert.ok(snap.exists);
});

test('testSendNotification: blocked when kill switch ON', async () => {
  await assert.rejects(() => testSendNotification({
    lineUserId: 'U2',
    text: 'hello',
    killSwitch: true,
    pushFn: async () => ({ status: 200 })
  }), /kill switch/i);
});
