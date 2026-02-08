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
const { planSegmentSend } = require('../../src/usecases/phase67/planSegmentSend');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase76: plan returns templateVersion from active template', async () => {
  await templatesVRepo.createTemplateVersion({
    templateKey: 'ops_alert',
    content: { body: 'v1' },
    status: 'active'
  });

  const result = await planSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    requestedBy: 'ops'
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }] })
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.templateVersion, 1);
});
