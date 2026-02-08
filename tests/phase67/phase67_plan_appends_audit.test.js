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
const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');
const { planSegmentSend } = require('../../src/usecases/phase67/planSegmentSend');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase67: plan appends audit log', async () => {
  await notificationTemplatesRepo.createTemplate({ key: 'ops_alert', title: 'Alert', body: 'Body', status: 'active' });

  const result = await planSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: { readinessStatus: 'READY' },
    requestedBy: 'ops'
  }, {
    buildSendSegment: async () => ({
      ok: true,
      items: [
        { lineUserId: 'U1' },
        { lineUserId: 'U2' }
      ]
    })
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.count, 2);

  const logs = await auditLogsRepo.listAuditLogs({ action: 'segment_send.plan', templateKey: 'ops_alert' });
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].payloadSummary.templateKey, 'ops_alert');
});
