import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dryrun = readFileSync('.github/workflows/phase22-scheduled-dryrun.yml', 'utf8');
const write = readFileSync('.github/workflows/phase22-scheduled-write.yml', 'utf8');

function assertSummaryKeys(contents) {
  assert.match(contents, /result:/);
  assert.match(contents, /reasonCode:/);
  assert.match(contents, /stage:/);
  assert.match(contents, /failure_class:/);
  assert.match(contents, /nextAction:/);
}

test('phase23 t02: dryrun workflow summary includes required keys', () => {
  assertSummaryKeys(dryrun);
});

test('phase23 t02: write workflow summary includes required keys', () => {
  assertSummaryKeys(write);
});
