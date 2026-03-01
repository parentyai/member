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
const { planRetryQueuedSend } = require('../../src/usecases/phase73/planRetryQueuedSend');
const { giveUpRetryQueuedSend } = require('../../src/usecases/phase73/giveUpRetryQueuedSend');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-03-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase73: retry give-up marks queue item as GAVE_UP with audit fields', async () => {
  const queued = await sendRetryQueueRepo.enqueueFailure({
    lineUserId: 'U1',
    templateKey: 'ops_alert',
    payloadSnapshot: { lineUserId: 'U1', text: 'Body', notificationId: 'ops_alert' },
    reason: 'send_failed'
  });

  const now = new Date('2026-03-01T10:00:00.000Z');
  const confirmTokenSecret = 'test-confirm-secret';
  const plan = await planRetryQueuedSend({ queueId: queued.id, decidedBy: 'ops' }, { now, confirmTokenSecret });
  assert.strictEqual(plan.ok, true);

  const result = await giveUpRetryQueuedSend({
    queueId: queued.id,
    planHash: plan.planHash,
    confirmToken: plan.confirmToken,
    reason: 'manual_cleanup',
    decidedBy: 'ops'
  }, {
    now,
    confirmTokenSecret
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 'GAVE_UP');
  const stored = await sendRetryQueueRepo.getQueueItem(queued.id);
  assert.strictEqual(stored.status, 'GAVE_UP');
  assert.strictEqual(stored.giveUpReason, 'manual_cleanup');
  assert.strictEqual(stored.resolvedBy, 'ops');
});

test('phase73: retry give-up rejects invalid confirm token and keeps PENDING', async () => {
  const queued = await sendRetryQueueRepo.enqueueFailure({
    lineUserId: 'U1',
    templateKey: 'ops_alert',
    payloadSnapshot: { lineUserId: 'U1', text: 'Body', notificationId: 'ops_alert' },
    reason: 'send_failed'
  });

  const now = new Date('2026-03-01T10:00:00.000Z');
  const confirmTokenSecret = 'test-confirm-secret';
  const plan = await planRetryQueuedSend({ queueId: queued.id, decidedBy: 'ops' }, { now, confirmTokenSecret });
  assert.strictEqual(plan.ok, true);

  const result = await giveUpRetryQueuedSend({
    queueId: queued.id,
    planHash: plan.planHash,
    confirmToken: 'invalid_token',
    reason: 'manual_cleanup',
    decidedBy: 'ops'
  }, {
    now,
    confirmTokenSecret
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'confirm_token_mismatch');
  assert.strictEqual(result.status, 409);
  const stored = await sendRetryQueueRepo.getQueueItem(queued.id);
  assert.strictEqual(stored.status, 'PENDING');
});

test('phase73: retry give-up rejects non-pending queue item', async () => {
  const queued = await sendRetryQueueRepo.enqueueFailure({
    lineUserId: 'U1',
    templateKey: 'ops_alert',
    payloadSnapshot: { lineUserId: 'U1', text: 'Body', notificationId: 'ops_alert' },
    reason: 'send_failed'
  });
  await sendRetryQueueRepo.markDone(queued.id);

  const result = await giveUpRetryQueuedSend({
    queueId: queued.id,
    planHash: 'rq_dummy',
    confirmToken: 'token'
  }, {});

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'queue_not_pending');
  assert.strictEqual(result.status, 409);
  assert.strictEqual(result.queueStatus, 'DONE');
});
