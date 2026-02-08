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

const templatesVRepo = require('../../src/repos/firestore/templatesVRepo');
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

test('phase76: execute rejects when templateVersion mismatched', async () => {
  await templatesVRepo.createTemplateVersion({
    templateKey: 'ops_alert',
    content: { body: 'v1' },
    status: 'active'
  });

  await planSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    requestedBy: 'ops'
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }] })
  });

  const result = await executeSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    requestedBy: 'ops',
    templateVersion: 2
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }] }),
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({ mode: 'EXECUTE', enabled: true }),
      normalizePhase48Config: (record) => ({ mode: record.mode, enabled: true })
    },
    getKillSwitch: async () => false,
    sendFn: async () => ({ ok: true })
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'template_version_mismatch');
});
