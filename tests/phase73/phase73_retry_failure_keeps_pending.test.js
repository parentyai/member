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

const sendRetryQueueRepo = require('../../src/repos/firestore/sendRetryQueueRepo');
const { retryQueuedSend } = require('../../src/usecases/phase73/retryQueuedSend');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase73: retry failure keeps pending with lastError', async () => {
  const queued = await sendRetryQueueRepo.enqueueFailure({
    lineUserId: 'U1',
    templateKey: 'ops_alert',
    payloadSnapshot: { lineUserId: 'U1', text: 'Body', notificationId: 'ops_alert' },
    reason: 'send_failed'
  });

  const result = await retryQueuedSend({ queueId: queued.id }, {
    sendFn: async () => {
      throw new Error('boom');
    },
    getKillSwitch: async () => false
  });

  assert.strictEqual(result.ok, false);
  const stored = await sendRetryQueueRepo.getQueueItem(queued.id);
  assert.strictEqual(stored.status, 'PENDING');
  assert.strictEqual(stored.lastError, 'boom');
});
