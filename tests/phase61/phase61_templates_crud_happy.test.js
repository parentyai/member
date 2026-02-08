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

test('phase61: templates CRUD happy path', async () => {
  const created = await repo.createTemplate({ key: 'ops_alert', title: 'Alert', body: 'Body', status: 'draft' });
  assert.ok(created.id);

  const updated = await repo.updateTemplate('ops_alert', { title: 'Alert v2' });
  assert.ok(updated.id);

  const activated = await repo.setStatus('ops_alert', 'active');
  assert.strictEqual(activated.status, 'active');

  const list = await repo.listTemplates({ status: 'active' });
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].key, 'ops_alert');
  assert.strictEqual(list[0].title, 'Alert v2');
});
