'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase777: spec contract freeze registry check passes and reports summary', () => {
  const run = spawnSync('node', ['scripts/check_llm_spec_contract_freeze.js', '--check'], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const payload = JSON.parse(String(run.stdout || '{}'));
  assert.equal(payload.ok, true);
  assert.ok(payload.summary && typeof payload.summary === 'object');
  assert.equal(typeof payload.summary.registryVersion, 'string');
  assert.equal(typeof payload.summary.registryHash, 'string');
  assert.equal(Number.isFinite(Number(payload.summary.requirementCount)), true);
  assert.equal(Number.isFinite(Number(payload.summary.blockingConflictCount)), true);
});
