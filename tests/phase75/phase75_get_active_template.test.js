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

test('phase75: get active template returns latest active version', async () => {
  await templatesVRepo.createTemplateVersion({
    templateKey: 'ops_alert',
    content: { body: 'v1' },
    status: 'active'
  });
  await templatesVRepo.createTemplateVersion({
    templateKey: 'ops_alert',
    content: { body: 'v2' },
    status: 'draft'
  });
  await templatesVRepo.createTemplateVersion({
    templateKey: 'ops_alert',
    content: { body: 'v3' },
    status: 'active'
  });

  const active = await templatesVRepo.getActiveTemplate({ templateKey: 'ops_alert' });
  assert.ok(active);
  assert.strictEqual(active.version, 3);
});
