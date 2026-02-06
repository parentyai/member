'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const dryrun = readFileSync('.github/workflows/phase22-scheduled-dryrun.yml', 'utf8');
const write = readFileSync('.github/workflows/phase22-scheduled-write.yml', 'utf8');

function assertWorkflow(contents) {
  assert.match(contents, /failure_class=/);
  assert.match(contents, /nextAction=/);
  assert.match(contents, /INVALID_ARGS/);
  assert.match(contents, /SUBPROCESS_EXIT_NONZERO/);
  assert.match(contents, /RUNTIME_ERROR/);
  assert.match(contents, /VERIFY_ENV_ERROR/);
}

test('phase22 t14: dryrun workflow contains failure_class rules', () => {
  assertWorkflow(dryrun);
});

test('phase22 t14: write workflow contains failure_class rules', () => {
  assertWorkflow(write);
});
