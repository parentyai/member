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

const notificationTemplatesRepo = require('../../src/repos/firestore/notificationTemplatesRepo');
const { planSegmentSend } = require('../../src/usecases/phase67/planSegmentSend');

let db;

beforeEach(() => {
  db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase67: plan does not send', async () => {
  await notificationTemplatesRepo.createTemplate({ key: 'ops_alert', title: 'Alert', body: 'Body', status: 'active' });

  await planSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    requestedBy: 'ops'
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }] })
  });

  const deliveries = db._state.collections.deliveries;
  assert.ok(!deliveries || Object.keys(deliveries.docs).length === 0);
});
