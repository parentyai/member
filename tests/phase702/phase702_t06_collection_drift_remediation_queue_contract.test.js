'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('phase702: package script exposes collection drift remediation queue command', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['audit:collection-drift:queue'], 'node scripts/report_collection_drift_remediation_queue.js');
});

test('phase702: collection drift remediation queue report prints required sections', () => {
  const result = spawnSync(process.execPath, ['scripts/report_collection_drift_remediation_queue.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'collection drift remediation queue report failed');
  const out = result.stdout || '';
  assert.ok(out.includes('[collection-drift-remediation-queue] report'));
  assert.ok(out.includes('"topQueue"'));
  assert.ok(out.includes('"priorityBand"'));
  assert.ok(out.includes('"dataModelOnlyCount"'));
  assert.ok(out.includes('"dataLifecycleOnlyCount"'));
});
