'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest } = require('../../src/infra/firestore');
const { getUserOperationalSummary } = require('../../src/usecases/admin/getUserOperationalSummary');

test('phase340: user summary require mode treats stale snapshot as not_available', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  t.after(() => {
    clearDbForTest();
  });

  await db.collection('ops_read_model_snapshots').doc('user_operational_summary__latest').set({
    snapshotType: 'user_operational_summary',
    snapshotKey: 'latest',
    asOf: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    freshnessMinutes: 60,
    data: { items: [{ lineUserId: 'U_stale' }] }
  });

  const result = await getUserOperationalSummary({
    includeMeta: true,
    snapshotMode: 'require',
    freshnessMinutes: 5
  });

  assert.ok(result && typeof result === 'object');
  assert.deepStrictEqual(result.items, []);
  assert.strictEqual(result.meta && result.meta.dataSource, 'not_available');
});
