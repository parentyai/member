'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('phase702: package script exposes consistency status report command', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['audit:consistency:status'], 'node scripts/report_consistency_status.js');
});

test('phase702: consistency status report prints required sections', () => {
  const result = spawnSync(process.execPath, ['scripts/report_consistency_status.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'status report failed');
  const out = result.stdout || '';
  assert.ok(out.includes('[consistency-status] summary'));
  assert.ok(out.includes('"collectionDrift"'));
  assert.ok(out.includes('"phaseOrigin"'));
  assert.ok(out.includes('"unreachable"'));
  assert.ok(out.includes('"scenarioKeyDrift"'));
});
