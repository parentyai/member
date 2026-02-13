'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function read(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

function assertPreflightSplit(contents, label) {
  assert.match(contents, /Validate required secrets exist/, `${label}: required secret preflight step missing`);
  assert.match(contents, /Missing Secret Manager secret/, `${label}: missing-secret error message missing`);
  assert.match(contents, /NOT_FOUND/, `${label}: NOT_FOUND branch missing`);
  assert.match(contents, /Secret visibility skipped/, `${label}: permission warning branch missing`);
  assert.match(contents, /Secret preflight mode/, `${label}: permission notice branch missing`);
  assert.match(contents, /secretmanager\.secrets\.get/, `${label}: permission-denied matcher missing`);
}

test('phase185: deploy workflow preflight separates missing from permission issues', () => {
  const contents = read('.github/workflows/deploy.yml');
  assertPreflightSplit(contents, 'deploy.yml');
});

test('phase185: deploy-webhook workflow preflight separates missing from permission issues', () => {
  const contents = read('.github/workflows/deploy-webhook.yml');
  assertPreflightSplit(contents, 'deploy-webhook.yml');
});

test('phase185: deploy-track workflow preflight separates missing from permission issues', () => {
  const contents = read('.github/workflows/deploy-track.yml');
  assertPreflightSplit(contents, 'deploy-track.yml');
});
