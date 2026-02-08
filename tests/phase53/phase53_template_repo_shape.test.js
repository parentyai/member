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

const repo = require('../../src/repos/firestore/notificationTemplatesRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase53: template repo stores and lists templates', async () => {
  await repo.createTemplate({ key: 'ops_escalate', text: 'Escalate', status: 'active' });
  const list = await repo.listTemplates(10);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].key, 'ops_escalate');
  const fetched = await repo.getTemplateByKey('ops_escalate');
  assert.strictEqual(fetched.text, 'Escalate');
});
