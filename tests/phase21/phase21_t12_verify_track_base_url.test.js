'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

function runScript(args, env) {
  return spawnSync(process.execPath, ['scripts/phase21_verify_day_window.js'].concat(args), {
    encoding: 'utf8',
    env: Object.assign({}, process.env, env || {})
  });
}

test('phase21 t12: accepts --track-base-url and does not emit trackBaseUrl required', () => {
  const result = runScript(['--track-base-url', 'https://example.com'], { TRACK_BASE_URL: '' });
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes('linkRegistryId required'));
  assert.equal(result.stderr.includes('trackBaseUrl required'), false);
});

test('phase21 t12: missing track base url exits with trackBaseUrl required', () => {
  const result = runScript([], { TRACK_BASE_URL: '' });
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes('trackBaseUrl required'));
});
