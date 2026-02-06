import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dryrun = readFileSync('.github/workflows/phase22-scheduled-dryrun.yml', 'utf8');
const write = readFileSync('.github/workflows/phase22-scheduled-write.yml', 'utf8');

function assertOidcAuth(contents) {
  assert.match(contents, /google-github-actions\/auth@v2/);
  assert.match(contents, /google-github-actions\/setup-gcloud@v2/);
}

test('phase23 t01: dryrun workflow includes OIDC auth and setup-gcloud', () => {
  assertOidcAuth(dryrun);
});

test('phase23 t01: write workflow includes OIDC auth and setup-gcloud', () => {
  assertOidcAuth(write);
});
