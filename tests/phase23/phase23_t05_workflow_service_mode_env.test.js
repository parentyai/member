import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dryrun = readFileSync('.github/workflows/phase22-scheduled-dryrun.yml', 'utf8');
const write = readFileSync('.github/workflows/phase22-scheduled-write.yml', 'utf8');

function assertServiceMode(contents) {
  assert.match(contents, /SERVICE_MODE:\s*member/);
}

test('phase23 t05: dryrun workflow sets SERVICE_MODE=member', () => {
  assertServiceMode(dryrun);
});

test('phase23 t05: write workflow sets SERVICE_MODE=member', () => {
  assertServiceMode(write);
});
