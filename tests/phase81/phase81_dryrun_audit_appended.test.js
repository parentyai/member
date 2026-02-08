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
const { dryRunSegmentSend } = require('../../src/usecases/phase81/dryRunSegmentSend');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase81: dry-run appends audit log', async () => {
  await notificationTemplatesRepo.createTemplate({ key: 'ops_alert', title: 'Alert', body: 'Body', status: 'active' });

  await dryRunSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    requestedBy: 'ops'
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }] })
  });

  const logs = await auditLogsRepo.listAuditLogs({ action: 'segment_send.dry_run', templateKey: 'ops_alert' });
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].payloadSummary.templateKey, 'ops_alert');
});
