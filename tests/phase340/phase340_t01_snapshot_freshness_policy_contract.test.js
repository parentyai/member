'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  resolveSnapshotFreshnessMinutes,
  isSnapshotFresh
} = require('../../src/domain/readModel/snapshotReadPolicy');

test('phase340: snapshot freshness helpers resolve minutes and stale judgement', () => {
  const minutes = resolveSnapshotFreshnessMinutes({ freshnessMinutes: 15 });
  assert.strictEqual(minutes, 15);

  const fresh = isSnapshotFresh({ asOf: new Date(Date.now() - 2 * 60 * 1000).toISOString() }, 10);
  const stale = isSnapshotFresh({ asOf: new Date(Date.now() - 50 * 60 * 1000).toISOString() }, 10);
  assert.strictEqual(fresh, true);
  assert.strictEqual(stale, false);
});
