'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('phase701: unreachable classification gate matches static index graph', () => {
  const result = spawnSync(process.execPath, ['scripts/check_unreachable_classification.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'unreachable classification check failed');
  assert.ok((result.stdout || '').includes('current_unreachable='));
});
