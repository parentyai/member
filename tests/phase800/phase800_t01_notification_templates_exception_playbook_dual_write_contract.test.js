'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const repo = require('../../src/repos/firestore/notificationTemplatesRepo');

test('phase800: notificationTemplatesRepo dual-writes exception_playbook canonical core event', async (t) => {
  const previousDualWrite = process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1;
  process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1 = 'true';
  t.after(() => {
    if (previousDualWrite === undefined) delete process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1;
    else process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1 = previousDualWrite;
  });

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const created = await repo.createTemplate({
    key: 'ops_escalate',
    title: 'Escalate to Ops',
    body: 'Escalation body',
    ctaText: 'Open Ops',
    linkRegistryId: 'link_ops_escalate',
    status: 'draft',
    notificationCategory: 'IMMEDIATE_ACTION',
    exceptionPlaybook: {
      domain: 'ops',
      topic: 'delivery_failure',
      countryCode: 'US',
      severity: 'high',
      symptomPatterns: ['push persisted failed', 'retry loop detected'],
      fallbackSteps: ['seal delivery', 'notify operator'],
      linkedTaskTemplates: ['task_template:ops_fix_and_rerun']
    }
  });

  await repo.updateTemplate('ops_escalate', {
    exceptionPlaybook: {
      exceptionCode: 'ops_escalate',
      domain: 'ops',
      topic: 'delivery_failure',
      countryCode: 'US',
      severity: 'critical',
      symptomPatterns: ['push persisted failed', 'retry loop detected'],
      fallbackSteps: ['seal delivery', 'notify operator', 'stop campaign'],
      escalationContacts: { queue: 'ops-primary' }
    }
  });

  await repo.setStatus('ops_escalate', 'active');

  const templateDoc = Object.values(db._state.collections.notification_templates.docs)
    .map((doc) => doc.data)
    .find((row) => row.key === 'ops_escalate');
  assert.ok(templateDoc);
  assert.ok(templateDoc.recordEnvelope && typeof templateDoc.recordEnvelope === 'object');
  assert.equal(templateDoc.recordEnvelope.record_type, 'notification_template');
  assert.equal(templateDoc.recordEnvelope.source_snapshot_ref, `notification_templates:${created.id}`);
  assert.equal(templateDoc.exceptionPlaybook.exceptionCode, 'ops_escalate');
  assert.equal(templateDoc.exceptionPlaybook.severity, 'critical');

  const outbox = db._state.collections.canonical_core_outbox;
  assert.ok(outbox, 'canonical_core_outbox collection must exist');
  const rows = Object.values(outbox.docs)
    .map((doc) => doc.data)
    .filter((row) => row.objectType === 'exception_playbook' && row.objectId === 'exception_playbook:ops_escalate');
  assert.ok(rows.length >= 1, 'exception playbook dual-write must emit at least one outbox event');
  const latest = rows.find((row) => row.payloadSummary && row.payloadSummary.status === 'active') || rows[rows.length - 1];
  assert.deepEqual(latest.materializationHints.targetTables, ['exception_playbook']);
  assert.equal(latest.payloadSummary.status, 'active');
  assert.equal(latest.payloadSummary.riskLevel, 'critical');
  assert.equal(latest.canonicalPayload.exceptionPlaybook.countryCode, 'US');
  assert.deepEqual(latest.canonicalPayload.exceptionPlaybook.fallbackSteps, [
    'seal delivery',
    'notify operator',
    'stop campaign'
  ]);
});
