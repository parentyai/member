'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const { test } = require('node:test');

test('phase310: repo-map check mode passes when generated artifact is current', () => {
  const run = spawnSync('node', ['scripts/generate_repo_map.js', '--check'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.strictEqual(run.status, 0, `stdout=${run.stdout}\nstderr=${run.stderr}`);
  assert.ok((run.stdout || '').includes('repo map check ok'));
});
