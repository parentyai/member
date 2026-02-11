'use strict';

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

function read(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

function assertHasEnvironmentSplit(contents, label) {
  assert.match(contents, /workflow_dispatch:/, `${label}: workflow_dispatch missing`);
  assert.match(contents, /target_environment:/, `${label}: target_environment input missing`);
  assert.match(contents, /-\s*stg/, `${label}: stg option missing`);
  assert.match(contents, /-\s*prod/, `${label}: prod option missing`);
  assert.match(contents, /environment:\s*\$\{\{[^}]*'prod'[^}]*'stg'[^}]*\}\}/, `${label}: dynamic environment missing`);
}

test('phase170: deploy workflow supports stg/prod environment split', () => {
  const contents = read('.github/workflows/deploy.yml');
  assertHasEnvironmentSplit(contents, 'deploy.yml');
});

test('phase170: deploy-webhook workflow supports stg/prod environment split', () => {
  const contents = read('.github/workflows/deploy-webhook.yml');
  assertHasEnvironmentSplit(contents, 'deploy-webhook.yml');
});

test('phase170: deploy-track workflow supports stg/prod environment split', () => {
  const contents = read('.github/workflows/deploy-track.yml');
  assertHasEnvironmentSplit(contents, 'deploy-track.yml');
});
