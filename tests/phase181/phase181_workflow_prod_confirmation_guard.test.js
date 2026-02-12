'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function read(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

function assertHasProdConfirmationGuard(contents, label) {
  assert.match(contents, /workflow_dispatch:/, `${label}: workflow_dispatch missing`);
  assert.match(contents, /confirm_production:/, `${label}: confirm_production input missing`);
  assert.match(contents, /Validate production confirmation/, `${label}: validation step missing`);
  assert.match(contents, /target_environment == 'prod'/, `${label}: prod conditional missing`);
  assert.match(contents, /confirm_production must be DEPLOY_PROD/, `${label}: guard message missing`);
  assert.match(contents, /DEPLOY_PROD/, `${label}: confirm token missing`);
}

test('phase181: deploy workflow requires explicit prod confirmation', () => {
  const contents = read('.github/workflows/deploy.yml');
  assertHasProdConfirmationGuard(contents, 'deploy.yml');
});

test('phase181: deploy-webhook workflow requires explicit prod confirmation', () => {
  const contents = read('.github/workflows/deploy-webhook.yml');
  assertHasProdConfirmationGuard(contents, 'deploy-webhook.yml');
});

test('phase181: deploy-track workflow requires explicit prod confirmation', () => {
  const contents = read('.github/workflows/deploy-track.yml');
  assertHasProdConfirmationGuard(contents, 'deploy-track.yml');
});
