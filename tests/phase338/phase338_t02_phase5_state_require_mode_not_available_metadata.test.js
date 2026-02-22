'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest } = require('../../src/infra/firestore');
const { getUserStateSummary } = require('../../src/usecases/phase5/getUserStateSummary');

test('phase338: phase5 state require mode returns not_available metadata when snapshot missing', async (t) => {
  setDbForTest(createDbStub());
  t.after(() => {
    clearDbForTest();
  });

  const result = await getUserStateSummary({
    lineUserId: 'U_missing_snapshot',
    snapshotMode: 'require',
    includeMeta: true
  });

  assert.ok(result && typeof result === 'object');
  assert.ok(result.item && result.item.notAvailable);
  assert.strictEqual(result.item.notAvailableReason, 'snapshot_required_not_available');
  assert.strictEqual(result.meta && result.meta.dataSource, 'not_available');
  assert.ok(Number.isFinite(Number(result.meta && result.meta.freshnessMinutes)));
});
