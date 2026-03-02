'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('phase701: collection drift gate passes with current SSOT allowlist', () => {
  const result = spawnSync(process.execPath, ['scripts/check_collection_drift.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'collection drift check failed');
  assert.ok((result.stdout || '').includes('collection_drift current'));
});
