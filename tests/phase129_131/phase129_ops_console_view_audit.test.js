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

const usersRepo = require('../../src/repos/firestore/usersRepo');
const { getOpsConsole } = require('../../src/usecases/phase25/getOpsConsole');

let db;

beforeEach(() => {
  db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('2026-02-09T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase129: ops console view appends audit_logs with traceId', async () => {
  await usersRepo.createUser('U1', { memberNumber: 'ABC1234', createdAt: '2000-01-01T00:00:00Z' });

  const result = await getOpsConsole({
    lineUserId: 'U1',
    auditView: true,
    actor: 'ops_readonly',
    requestId: 'REQ1',
    traceId: 'TRACE1'
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.traceId, 'TRACE1');
  assert.strictEqual(result.requestId, 'REQ1');
  assert.ok(result.viewAuditId);

  const auditCollection = db._state.collections.audit_logs;
  assert.ok(auditCollection);
  const docs = Object.values(auditCollection.docs);
  assert.strictEqual(docs.length, 1);
  const audit = docs[0].data;
  assert.strictEqual(audit.action, 'ops_console.view');
  assert.strictEqual(audit.traceId, 'TRACE1');
  assert.strictEqual(audit.requestId, 'REQ1');
  assert.deepStrictEqual(audit.payloadSummary, { lineUserId: 'U1', readinessStatus: result.readinessStatus });
});
