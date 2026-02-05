'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('phase21 t15: missing track base url exits with code 2', () => {
  const result = spawnSync(process.execPath, ['scripts/phase21_verify_day_window.js'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { GOOGLE_APPLICATION_CREDENTIALS: '' })
  });
  assert.equal(result.status, 2);
  assert.ok(result.stderr.includes('trackBaseUrl required'));
});

test('phase21 t16: verify env does not emit VERIFY_ENV_ERROR after npm ci', () => {
  const { loadFirestoreDeps } = require('../../scripts/phase21_verify_day_window');
  assert.doesNotThrow(() => loadFirestoreDeps());
});
