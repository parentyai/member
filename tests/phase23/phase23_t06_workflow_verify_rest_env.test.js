import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dryrun = readFileSync('.github/workflows/phase22-scheduled-dryrun.yml', 'utf8');
const write = readFileSync('.github/workflows/phase22-scheduled-write.yml', 'utf8');

function assertVerifyRest(contents) {
  assert.match(contents, /PHASE21_VERIFY_REST:\s*"1"/);
}

test('phase23 t06: dryrun workflow sets PHASE21_VERIFY_REST=1', () => {
  assertVerifyRest(dryrun);
});

test('phase23 t06: write workflow sets PHASE21_VERIFY_REST=1', () => {
  assertVerifyRest(write);
});
