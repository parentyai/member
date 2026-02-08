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

test('phase61: active template cannot be edited', async () => {
  await repo.createTemplate({ key: 'ops_active', text: 'Active', status: 'active' });

  await assert.rejects(
    () => repo.updateTemplate('ops_active', { text: 'Updated' }),
    /template not editable/
  );
});
