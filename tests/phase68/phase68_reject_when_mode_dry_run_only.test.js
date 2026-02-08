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
const { executeSegmentSend } = require('../../src/usecases/phase68/executeSegmentSend');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase68: reject when mode is dry_run_only', async () => {
  await notificationTemplatesRepo.createTemplate({ key: 'ops_alert', title: 'Alert', body: 'Body', status: 'active' });
  await auditLogsRepo.appendAuditLog({
    action: 'segment_send.plan',
    templateKey: 'ops_alert',
    planHash: 'hash1',
    count: 1,
    createdAt: '2026-02-08T00:00:00Z'
  });

  const result = await executeSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    requestedBy: 'ops'
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }] }),
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({ mode: 'DRY_RUN_ONLY' }),
      normalizePhase48Config: (record) => ({ mode: record.mode, enabled: true })
    },
    getKillSwitch: async () => false,
    sendFn: async () => ({ ok: true })
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'automation_mode_not_execute');
});
