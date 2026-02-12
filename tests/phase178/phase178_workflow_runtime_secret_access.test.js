'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function read(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

function assertHasSecretAccessGuard(contents, label) {
  assert.match(contents, /Ensure runtime SA can access required secrets/, `${label}: guard step missing`);
  assert.match(contents, /if gcloud secrets add-iam-policy-binding/, `${label}: binding command missing`);
  assert.match(contents, /roles\/secretmanager\.secretAccessor/, `${label}: secret accessor role missing`);
  assert.match(contents, /serviceAccount:\$\{RUNTIME_SA_EMAIL\}/, `${label}: runtime SA binding target missing`);
  assert.match(contents, /::warning title=Secret IAM update skipped::/, `${label}: warning fallback missing`);
}

test('phase178: deploy workflow grants runtime SA secret accessor for member secrets', () => {
  const contents = read('.github/workflows/deploy.yml');
  assertHasSecretAccessGuard(contents, 'deploy.yml');
  assert.match(contents, /LINE_CHANNEL_SECRET/, 'deploy.yml: LINE_CHANNEL_SECRET missing');
  assert.match(contents, /LINE_CHANNEL_ACCESS_TOKEN/, 'deploy.yml: LINE_CHANNEL_ACCESS_TOKEN missing');
  assert.match(contents, /ADMIN_OS_TOKEN/, 'deploy.yml: ADMIN_OS_TOKEN missing');
  assert.match(contents, /TRACK_TOKEN_SECRET/, 'deploy.yml: TRACK_TOKEN_SECRET missing');
  assert.match(contents, /REDAC_MEMBERSHIP_ID_HMAC_SECRET/, 'deploy.yml: REDAC_MEMBERSHIP_ID_HMAC_SECRET missing');
  assert.match(contents, /OPS_CONFIRM_TOKEN_SECRET/, 'deploy.yml: OPS_CONFIRM_TOKEN_SECRET missing');
});

test('phase178: deploy-webhook workflow grants runtime SA secret accessor for webhook secrets', () => {
  const contents = read('.github/workflows/deploy-webhook.yml');
  assertHasSecretAccessGuard(contents, 'deploy-webhook.yml');
  assert.match(contents, /LINE_CHANNEL_SECRET/, 'deploy-webhook.yml: LINE_CHANNEL_SECRET missing');
  assert.match(contents, /LINE_CHANNEL_ACCESS_TOKEN/, 'deploy-webhook.yml: LINE_CHANNEL_ACCESS_TOKEN missing');
  assert.match(contents, /REDAC_MEMBERSHIP_ID_HMAC_SECRET/, 'deploy-webhook.yml: REDAC_MEMBERSHIP_ID_HMAC_SECRET missing');
});

test('phase178: deploy-track workflow grants runtime SA secret accessor for track token secret', () => {
  const contents = read('.github/workflows/deploy-track.yml');
  assertHasSecretAccessGuard(contents, 'deploy-track.yml');
  assert.match(contents, /TRACK_TOKEN_SECRET/, 'deploy-track.yml: TRACK_TOKEN_SECRET missing');
});
