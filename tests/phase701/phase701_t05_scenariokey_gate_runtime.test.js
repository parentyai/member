'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('phase701: scenarioKey drift gate blocks new drift and passes baseline', () => {
  const result = spawnSync(process.execPath, ['scripts/check_scenariokey_drift.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'scenarioKey drift check failed');
  assert.ok((result.stdout || '').includes('scenariokey_drift current'));
});
