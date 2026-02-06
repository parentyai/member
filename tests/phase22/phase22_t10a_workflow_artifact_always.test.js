import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dryrun = readFileSync('.github/workflows/phase22-scheduled-dryrun.yml', 'utf8');
const write = readFileSync('.github/workflows/phase22-scheduled-write.yml', 'utf8');

function assertArtifactConfig(contents, name) {
  assert.match(contents, /actions\/upload-artifact@v4/);
  assert.match(contents, /if:\s*always\(\)/);
  assert.match(contents, new RegExp(`name:\\s*${name}`));
  assert.match(contents, /stdout\.txt/);
  assert.match(contents, /stderr\.txt/);
  assert.match(contents, /exit_code\.txt/);
}

test('phase22 t10a: dryrun workflow uploads artifacts always', () => {
  assertArtifactConfig(dryrun, 'phase22-dryrun');
});

test('phase22 t10a: write workflow uploads artifacts always', () => {
  assertArtifactConfig(write, 'phase22-write');
});
