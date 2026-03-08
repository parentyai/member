'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const path = require('node:path');
const { test } = require('node:test');

test('phase784: feature flag governance check script passes', () => {
  const result = childProcess.spawnSync('node', ['scripts/check_feature_flag_governance.js'], {
    cwd: path.resolve(__dirname, '..', '..'),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
