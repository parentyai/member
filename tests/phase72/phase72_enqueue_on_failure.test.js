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
const { planSegmentSend } = require('../../src/usecases/phase67/planSegmentSend');
const { executeSegmentSend } = require('../../src/usecases/phase68/executeSegmentSend');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase72: enqueue retry queue on send failure', async () => {
  await notificationTemplatesRepo.createTemplate({ key: 'ops_alert', title: 'Alert', body: 'Body', status: 'active' });
  await planSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    requestedBy: 'ops'
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }, { lineUserId: 'U2' }] }),
    now: new Date('2026-02-08T10:00:00Z')
  });

  const result = await executeSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    requestedBy: 'ops'
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }, { lineUserId: 'U2' }] }),
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({ mode: 'EXECUTE', enabled: true }),
      normalizePhase48Config: (record) => ({ mode: record.mode, enabled: true })
    },
    getKillSwitch: async () => false,
    sendFn: async ({ lineUserId }) => {
      if (lineUserId === 'U2') throw new Error('boom');
      return { ok: true };
    }
  });

  assert.strictEqual(result.ok, false);
  const queued = await sendRetryQueueRepo.listPending(10);
  assert.strictEqual(queued.length, 1);
  assert.strictEqual(queued[0].lineUserId, 'U2');
  assert.strictEqual(queued[0].status, 'PENDING');
  assert.strictEqual(queued[0].templateKey, 'ops_alert');
});
