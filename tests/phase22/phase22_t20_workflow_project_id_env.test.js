'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const dryrun = readFileSync('.github/workflows/phase22-scheduled-dryrun.yml', 'utf8');
const write = readFileSync('.github/workflows/phase22-scheduled-write.yml', 'utf8');

function assertProjectIdEnv(contents) {
  assert.match(contents, /FIRESTORE_PROJECT_ID/);
  assert.match(contents, /\$\{\{\s*vars\.FIRESTORE_PROJECT_ID\s*\}\}/);
}

test('phase22 t20: dryrun workflow provides FIRESTORE_PROJECT_ID', () => {
  assertProjectIdEnv(dryrun);
});

test('phase22 t20: write workflow provides FIRESTORE_PROJECT_ID', () => {
  assertProjectIdEnv(write);
});
