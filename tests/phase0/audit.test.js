'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('./firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');

let db;

beforeEach(() => {
  db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('auditLogsRepo: append writes createdAt', async () => {
  const result = await auditLogsRepo.appendAuditLog({
    actor: 'tester',
    action: 'link_registry.create',
    entityType: 'link_registry',
    entityId: 'link_1'
  });
  assert.ok(result.id);
  const collection = db._state.collections.audit_logs;
  assert.ok(collection);
  const stored = collection.docs[result.id];
  assert.ok(stored);
  assert.strictEqual(stored.data.actor, 'tester');
  assert.strictEqual(stored.data.createdAt, 'SERVER_TIMESTAMP');
});

test('auditLogsRepo: append respects provided createdAt', async () => {
  const result = await auditLogsRepo.appendAuditLog({
    actor: 'tester',
    action: 'notifications.test_send',
    entityType: 'notification',
    entityId: 'n1',
    createdAt: 'CUSTOM_TS'
  });
  const stored = db._state.collections.audit_logs.docs[result.id];
  assert.strictEqual(stored.data.createdAt, 'CUSTOM_TS');
});
