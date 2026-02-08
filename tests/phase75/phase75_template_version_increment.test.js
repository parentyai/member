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

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase75: template version increments per key', async () => {
  const first = await templatesVRepo.createTemplateVersion({
    templateKey: 'ops_alert',
    content: { body: 'v1' },
    status: 'draft'
  });
  const second = await templatesVRepo.createTemplateVersion({
    templateKey: 'ops_alert',
    content: { body: 'v2' },
    status: 'active'
  });

  assert.strictEqual(first.version, 1);
  assert.strictEqual(second.version, 2);
});
