'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase351: dashboard kpi route accepts snapshotRefresh and allows snapshot bypass in prefer mode', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/osDashboardKpi.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('function parseSnapshotRefresh(req)'));
  assert.ok(src.includes("throw new Error('invalid snapshotRefresh')"));
  assert.ok(src.includes('snapshotRefresh = parseSnapshotRefresh(req);'));
  assert.ok(src.includes('const skipSnapshotRead = snapshotRefresh === true && !isSnapshotRequired(snapshotMode);'));
  assert.ok(src.includes('if (snapshotReadEnabled && !skipSnapshotRead) {'));
});
