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

const notificationTemplatesRepo = require('../../src/repos/firestore/notificationTemplatesRepo');
const { planSegmentSend } = require('../../src/usecases/phase67/planSegmentSend');
const { computePlanHash, resolveDateBucket } = require('../../src/usecases/phase67/segmentSendHash');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase71: plan returns planHash with stable bucket', async () => {
  await notificationTemplatesRepo.createTemplate({ key: 'ops_alert', title: 'Alert', body: 'Body', status: 'active' });
  const now = new Date('2026-02-08T12:00:00Z');

  const result = await planSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: { readinessStatus: 'READY' },
    requestedBy: 'ops'
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U2' }, { lineUserId: 'U1' }] }),
    now
  });

  const expectedBucket = resolveDateBucket(now);
  const expectedHash = computePlanHash('ops_alert', ['U1', 'U2'], expectedBucket);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.planHash, expectedHash);
});
