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

const repo = require('../../src/repos/firestore/decisionLogsRepo');

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

test('phase24 t02: appendDecision sets decidedAt and createdAt serverTimestamp', async () => {
  await repo.appendDecision({
    subjectType: 'user',
    subjectId: 'u1',
    decision: 'OK',
    decidedBy: 'ops',
    reason: ''
  });
  const docs = db._state.collections.decision_logs.docs;
  const doc = docs[Object.keys(docs)[0]];
  assert.strictEqual(doc.data.createdAt, 'SERVER_TIMESTAMP');
  assert.strictEqual(doc.data.decidedAt, 'SERVER_TIMESTAMP');
});

test('phase24 t02: appendDecision does not overwrite previous entries', async () => {
  await repo.appendDecision({
    subjectType: 'user',
    subjectId: 'u1',
    decision: 'OK',
    decidedBy: 'ops',
    reason: ''
  });
  await repo.appendDecision({
    subjectType: 'user',
    subjectId: 'u1',
    decision: 'HOLD',
    decidedBy: 'ops',
    reason: 'waiting'
  });
  const docs = db._state.collections.decision_logs.docs;
  assert.strictEqual(Object.keys(docs).length, 2);
});

test('phase24 t02: getLatestDecision returns most recent by decidedAt', async () => {
  setServerTimestampForTest(1);
  await repo.appendDecision({
    subjectType: 'notification',
    subjectId: 'n1',
    decision: 'OK',
    decidedBy: 'ops',
    reason: ''
  });
  setServerTimestampForTest(2);
  await repo.appendDecision({
    subjectType: 'notification',
    subjectId: 'n1',
    decision: 'ESCALATE',
    decidedBy: 'ops',
    reason: 'risk'
  });
  const latest = await repo.getLatestDecision('notification', 'n1');
  assert.strictEqual(latest.decidedAt, 2);
  assert.strictEqual(latest.decision, 'ESCALATE');
});
