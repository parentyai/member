'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('phase21 t15: missing track base url exits with code 2', () => {
  const result = spawnSync(process.execPath, ['scripts/phase21_verify_day_window.js'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.ok(result.stderr.includes('trackBaseUrl required'));
});
