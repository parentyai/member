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
const sendRetryQueueRepo = require('../../src/repos/firestore/sendRetryQueueRepo');
const { dryRunSegmentSend } = require('../../src/usecases/phase81/dryRunSegmentSend');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase81: dry-run has no side effects', async () => {
  await notificationTemplatesRepo.createTemplate({ key: 'ops_alert', title: 'Alert', body: 'Body', status: 'active' });

  const result = await dryRunSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    requestedBy: 'ops'
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }, { lineUserId: 'U2' }] })
  });

  assert.strictEqual(result.ok, true);
  const queued = await sendRetryQueueRepo.listPending(10);
  assert.strictEqual(queued.length, 0);
});
