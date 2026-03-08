'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase760: replay harness processes all required fixtures', () => {
  const output = execFileSync('node', ['tools/replay/v1/run_replay.js'], { cwd: ROOT }).toString('utf8');
  const parsed = JSON.parse(output);
  assert.equal(parsed.ok, true);
  assert.ok(Array.isArray(parsed.results));
  assert.equal(parsed.results.length, 6);
});
