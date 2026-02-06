import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dryrun = readFileSync('.github/workflows/phase22-scheduled-dryrun.yml', 'utf8');
const write = readFileSync('.github/workflows/phase22-scheduled-write.yml', 'utf8');

function assertHints(contents) {
  assert.match(contents, /humanDecisionHint/);
  assert.match(contents, /NO_ACTION/);
  assert.match(contents, /HOLD_AND_RERUN/);
  assert.match(contents, /FIX_BEFORE_RERUN/);
  assert.match(contents, /INSPECT_ARTIFACTS/);
}

test('phase23 t03: dryrun workflow includes humanDecisionHint rules', () => {
  assertHints(dryrun);
});

test('phase23 t03: write workflow includes humanDecisionHint rules', () => {
  assertHints(write);
});
