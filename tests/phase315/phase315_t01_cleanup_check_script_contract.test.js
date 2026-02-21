'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const { test } = require('node:test');

test('phase315: cleanup check script passes when generated artifacts are current', () => {
  const result = spawnSync(process.execPath, ['scripts/check_structural_cleanup.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout || 'cleanup check failed');
});
