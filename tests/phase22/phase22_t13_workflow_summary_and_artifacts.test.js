'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const dryrun = readFileSync('.github/workflows/phase22-scheduled-dryrun.yml', 'utf8');
const write = readFileSync('.github/workflows/phase22-scheduled-write.yml', 'utf8');

function assertWorkflow(contents, artifactName) {
  assert.match(contents, /actions\/upload-artifact@v4/);
  assert.match(contents, /if:\s*always\(\)/);
  assert.match(contents, new RegExp(`name:\\s*${artifactName}`));
  assert.match(contents, /stdout\.txt/);
  assert.match(contents, /stderr\.txt/);
  assert.match(contents, /exit_code\.txt/);
  assert.match(contents, /GITHUB_STEP_SUMMARY/);
  assert.match(contents, /Write Phase22 summary/);
}

test('phase22 t13: dryrun workflow uploads artifacts and writes summary', () => {
  assertWorkflow(dryrun, 'phase22-dryrun');
});

test('phase22 t13: write workflow uploads artifacts and writes summary', () => {
  assertWorkflow(write, 'phase22-write');
});
