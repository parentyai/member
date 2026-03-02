'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('phase702: collection drift details report prints model/lifecycle detail blocks', () => {
  const result = spawnSync(process.execPath, ['scripts/report_collection_drift_details.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'collection drift details report failed');
  const out = result.stdout || '';
  assert.ok(out.includes('[collection-drift-details] report'));
  assert.ok(out.includes('"dataModelOnly"'));
  assert.ok(out.includes('"dataLifecycleOnly"'));
  assert.ok(out.includes('"policy"'));
  assert.ok(out.includes('"dataModelOnlyAdded"'));
  assert.ok(out.includes('"dataLifecycleOnlyAdded"'));
});
