'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const cityPackFeedbackRepo = require('../../src/repos/firestore/cityPackFeedbackRepo');

test('phase306: city_pack_feedback supports slot/message/resolution and status extensions', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const created = await cityPackFeedbackRepo.createFeedback({
      status: 'new',
      lineUserId: 'line_u_fb_306',
      regionKey: 'TX::austin',
      slotKey: 'transport',
      message: 'バス路線が古いです',
      resolution: null,
      traceId: 'trace_306_feedback'
    });

    const row = await cityPackFeedbackRepo.getFeedback(created.id);
    assert.ok(row);
    assert.strictEqual(row.status, 'new');
    assert.strictEqual(row.slotKey, 'transport');
    assert.strictEqual(row.message, 'バス路線が古いです');
    assert.strictEqual(row.feedbackText, 'バス路線が古いです');

    await cityPackFeedbackRepo.updateFeedback(created.id, {
      status: 'resolved',
      resolution: '市公式サイト更新を確認',
      resolvedAt: '2026-02-21T10:00:00.000Z'
    });

    const updated = await cityPackFeedbackRepo.getFeedback(created.id);
    assert.strictEqual(updated.status, 'resolved');
    assert.strictEqual(updated.resolution, '市公式サイト更新を確認');
    assert.strictEqual(updated.resolvedAt, '2026-02-21T10:00:00.000Z');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
