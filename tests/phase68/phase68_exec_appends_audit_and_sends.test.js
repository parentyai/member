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
const { createConfirmToken } = require('../../src/domain/confirmToken');
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

test('phase68: execute appends audit and sends', async () => {
  await notificationTemplatesRepo.createTemplate({ key: 'ops_alert', title: 'Alert', body: 'Body', status: 'active' });

  const plan = await planSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    requestedBy: 'ops'
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }, { lineUserId: 'U2' }] })
  });

  const now = new Date('2026-02-08T10:00:00.000Z');
  const confirmTokenSecret = 'test-confirm-secret';
  const confirmToken = createConfirmToken({
    planHash: plan.planHash,
    templateKey: plan.templateKey,
    templateVersion: plan.templateVersion,
    segmentKey: null
  }, { now, secret: confirmTokenSecret });

  let sendCount = 0;
  const result = await executeSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    requestedBy: 'ops',
    planHash: plan.planHash,
    confirmToken
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }, { lineUserId: 'U2' }] }),
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({ mode: 'EXECUTE', enabled: true }),
      normalizePhase48Config: (record) => ({ mode: record.mode, enabled: true })
    },
    now,
    confirmTokenSecret,
    getKillSwitch: async () => false,
    sendFn: async () => { sendCount += 1; }
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(sendCount, 2);

  const logs = await auditLogsRepo.listAuditLogs({ action: 'segment_send.execute', templateKey: 'ops_alert' });
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].payloadSummary.executedCount, 2);
});
