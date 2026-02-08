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
const { executeSegmentSend } = require('../../src/usecases/phase68/executeSegmentSend');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase79: audit log contains run and plan snapshots', async () => {
  await notificationTemplatesRepo.createTemplate({ key: 'ops_alert', title: 'Alert', body: 'Body', status: 'active' });

  const plan = await planSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    segmentKey: 'ready_only',
    filterSnapshot: { readinessStatus: 'READY' },
    requestedBy: 'ops'
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }, { lineUserId: 'U2' }] })
  });

  await executeSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    segmentKey: 'ready_only',
    filterSnapshot: { readinessStatus: 'READY' },
    requestedBy: 'ops',
    planHash: plan.planHash
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }, { lineUserId: 'U2' }] }),
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({ mode: 'EXECUTE', enabled: true }),
      normalizePhase48Config: (record) => ({ mode: record.mode, enabled: true })
    },
    getKillSwitch: async () => false,
    sendFn: async () => ({ ok: true })
  });

  const logs = await auditLogsRepo.listAuditLogs({ action: 'segment_send.execute', templateKey: 'ops_alert' });
  assert.strictEqual(logs.length, 1);
  const snapshot = logs[0].snapshot;
  assert.ok(snapshot.runId);
  assert.ok(snapshot.planSnapshot);
  assert.strictEqual(snapshot.segmentKey, 'ready_only');
  assert.deepStrictEqual(snapshot.filterSnapshot, { readinessStatus: 'READY' });
  assert.strictEqual(snapshot.planSnapshot.count, 2);
});
