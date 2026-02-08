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
const { listRetryQueue } = require('../../src/usecases/phase73/listRetryQueue');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase73: list retry queue returns pending only', async () => {
  const first = await sendRetryQueueRepo.enqueueFailure({
    lineUserId: 'U1',
    templateKey: 'ops_alert',
    payloadSnapshot: { lineUserId: 'U1', text: 'Body' },
    reason: 'send_failed'
  });
  const second = await sendRetryQueueRepo.enqueueFailure({
    lineUserId: 'U2',
    templateKey: 'ops_alert',
    payloadSnapshot: { lineUserId: 'U2', text: 'Body' },
    reason: 'send_failed'
  });
  await sendRetryQueueRepo.markDone(second.id);

  const result = await listRetryQueue({}, {});
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.items.length, 1);
  assert.strictEqual(result.items[0].id, first.id);
});
