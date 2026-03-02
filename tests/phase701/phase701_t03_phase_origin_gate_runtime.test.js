'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('phase701: phase origin gate resolves required targets to known phases', () => {
  const result = spawnSync(process.execPath, ['scripts/check_phase_origin.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'phase origin check failed');
  assert.ok((result.stdout || '').includes('unknown_count=0'));
});
