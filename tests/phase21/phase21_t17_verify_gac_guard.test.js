'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('phase21 t17: GAC set exits with code 2', () => {
  const env = Object.assign({}, process.env, {
    GOOGLE_APPLICATION_CREDENTIALS: '/tmp/fake.json'
  });
  const result = spawnSync(process.execPath, [
    'scripts/phase21_verify_day_window.js',
    '--track-base-url',
    'https://example.com',
    '--linkRegistryId',
    'l1'
  ], { encoding: 'utf8', env });
  assert.equal(result.status, 2);
  assert.ok(result.stderr.includes('VERIFY_ENV_ERROR: GOOGLE_APPLICATION_CREDENTIALS is set'));
});

test('phase21 t17: allow-gac bypasses guard', () => {
  const { isGacBlocked } = require('../../scripts/phase21_verify_day_window');
  const blocked = isGacBlocked({ allowGac: true }, { GOOGLE_APPLICATION_CREDENTIALS: '/tmp/fake.json' });
  assert.equal(blocked, false);
});
