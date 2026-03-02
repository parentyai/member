'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('phase702: package script exposes scenariokey drift details report command', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['audit:scenariokey-drift:details'], 'node scripts/report_scenariokey_drift_details.js');
});

test('phase702: scenariokey drift details report prints alias and grouped path sections', () => {
  const result = spawnSync(process.execPath, ['scripts/report_scenariokey_drift_details.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'scenariokey drift details report failed');
  const out = result.stdout || '';
  assert.ok(out.includes('[scenariokey-drift-details] report'));
  assert.ok(out.includes('"alias": "scenario"'));
  assert.ok(out.includes('"alias": "scenarioKey"'));
  assert.ok(out.includes('"groupedCurrentPaths"'));
});
