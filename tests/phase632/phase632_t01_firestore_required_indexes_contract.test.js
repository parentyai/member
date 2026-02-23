'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const REQUIRED_PATH = path.join(process.cwd(), 'docs', 'REPO_AUDIT_INPUTS', 'firestore_required_indexes.json');

function findIndex(indexes, id) {
  return indexes.find((item) => item && item.id === id) || null;
}

test('phase632: firestore_required_indexes defines mandatory stg recovery indexes with evidence', () => {
  const raw = fs.readFileSync(REQUIRED_PATH, 'utf8');
  const payload = JSON.parse(raw);
  assert.ok(Array.isArray(payload.indexes));
  assert.ok(payload.indexes.length >= 6);

  const auditLogs = findIndex(payload.indexes, 'audit_logs_action_createdAt_desc');
  const linkRegistry = findIndex(payload.indexes, 'link_registry_lastHealth_state_createdAt_desc');
  const cityPacks = findIndex(payload.indexes, 'city_packs_language_status_updatedAt_desc');
  const notifications = findIndex(payload.indexes, 'notifications_status_createdAt_desc');
  const retryQueue = findIndex(payload.indexes, 'send_retry_queue_status_createdAt_desc');
  const decisionLogs = findIndex(payload.indexes, 'decision_logs_audit_notificationId_decidedAt_desc');
  assert.ok(auditLogs, 'audit_logs index missing');
  assert.ok(linkRegistry, 'link_registry index missing');
  assert.ok(cityPacks, 'city_packs index missing');
  assert.ok(notifications, 'notifications index missing');
  assert.ok(retryQueue, 'send_retry_queue index missing');
  assert.ok(decisionLogs, 'decision_logs index missing');

  [auditLogs, linkRegistry, cityPacks, notifications, retryQueue, decisionLogs].forEach((item) => {
    assert.ok(typeof item.collectionGroup === 'string' && item.collectionGroup.length > 0);
    assert.strictEqual(item.queryScope, 'COLLECTION');
    assert.ok(Array.isArray(item.fields) && item.fields.length > 0);
    item.fields.forEach((field) => {
      assert.ok(typeof field.fieldPath === 'string' && field.fieldPath.length > 0);
      assert.notStrictEqual(field.fieldPath, '__name__');
      assert.ok(field.order === 'ASCENDING' || field.order === 'DESCENDING');
    });
    assert.ok(Array.isArray(item.sourceEvidence) && item.sourceEvidence.length > 0);
    item.sourceEvidence.forEach((evidence) => {
      assert.ok(typeof evidence.path === 'string' && evidence.path.length > 0);
      assert.ok(Number.isInteger(Number(evidence.line)) && Number(evidence.line) > 0);
    });
  });
});
