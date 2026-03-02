'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('phase702: package script exposes unreachable finalization status report command', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['audit:unreachable:status'], 'node scripts/report_unreachable_finalization_status.js');
});

test('phase702: unreachable finalization status report prints required sections', () => {
  const result = spawnSync(process.execPath, ['scripts/report_unreachable_finalization_status.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'unreachable finalization status report failed');
  const out = result.stdout || '';
  assert.ok(out.includes('[unreachable-finalization-status] report'));
  assert.ok(out.includes('"currentUnreachableCount"'));
  assert.ok(out.includes('"requiredTargets"'));
  assert.ok(out.includes('"future_deletion_candidate"'));
  assert.ok(out.includes('"keep_as_build_helper"'));
});
