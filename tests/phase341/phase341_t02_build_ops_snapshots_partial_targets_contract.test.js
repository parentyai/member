'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest } = require('../../src/infra/firestore');
const { buildOpsSnapshots } = require('../../src/usecases/admin/buildOpsSnapshots');

test('phase341: buildOpsSnapshots supports partial targets with backward-compatible default', async (t) => {
  setDbForTest(createDbStub());
  t.after(() => {
    clearDbForTest();
  });

  const result = await buildOpsSnapshots({
    dryRun: true,
    traceId: 'trace_phase341_partial',
    targets: ['user_operational_summary']
  });

  assert.strictEqual(result.ok, true);
  assert.ok(Array.isArray(result.summary.targets));
  assert.deepStrictEqual(result.summary.targets, ['user_operational_summary']);
  assert.strictEqual(result.summary.snapshotsBuilt, 1);
  assert.strictEqual(result.items[0].snapshotType, 'user_operational_summary');
});
