'use strict';

const assert = require('assert');
const { beforeEach, afterEach, test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { buildOpsSnapshots } = require('../../src/usecases/admin/buildOpsSnapshots');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase330: ops snapshot build includes notification_operational_summary item', async () => {
  const result = await buildOpsSnapshots({
    dryRun: true,
    scanLimit: 200
  });
  const types = new Set((result.items || []).map((item) => item.snapshotType));
  assert.ok(types.has('notification_operational_summary'));
});
