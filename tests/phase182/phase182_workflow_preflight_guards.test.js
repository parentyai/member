'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function read(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

function assertHasPreflightGuard(contents, label) {
  assert.match(contents, /Validate required deploy variables/, `${label}: required variable preflight step missing`);
  assert.match(contents, /Missing workflow variable/, `${label}: missing-variable error message missing`);
  assert.match(contents, /Validate required secrets exist/, `${label}: required secret preflight step missing`);
  assert.match(contents, /Missing Secret Manager secret/, `${label}: missing-secret error message missing`);
  assert.match(contents, /gcloud secrets describe/, `${label}: secret existence check command missing`);
}

test('phase182: deploy workflow preflight validates required vars and secrets', () => {
  const contents = read('.github/workflows/deploy.yml');
  assertHasPreflightGuard(contents, 'deploy.yml');
  assert.match(contents, /PUBLIC_BASE_URL/, 'deploy.yml: PUBLIC_BASE_URL required var check missing');
  assert.match(contents, /STORAGE_BUCKET/, 'deploy.yml: STORAGE_BUCKET required var check missing');
  assert.match(contents, /OPS_CONFIRM_TOKEN_SECRET/, 'deploy.yml: OPS_CONFIRM_TOKEN_SECRET secret check missing');
  assert.match(contents, /OPENAI_API_KEY/, 'deploy.yml: OPENAI_API_KEY secret check missing');
  assert.match(contents, /LLM_FEATURE_FLAG/, 'deploy.yml: LLM_FEATURE_FLAG env wiring missing');
  assert.match(contents, /OPENAI_MODEL/, 'deploy.yml: OPENAI_MODEL env wiring missing');
  assert.match(contents, /ENABLE_PAID_ORCHESTRATOR_V2/, 'deploy.yml: ENABLE_PAID_ORCHESTRATOR_V2 env wiring missing');
});

test('phase182: deploy-webhook workflow preflight validates required vars and secrets', () => {
  const contents = read('.github/workflows/deploy-webhook.yml');
  assertHasPreflightGuard(contents, 'deploy-webhook.yml');
  assert.match(contents, /FIRESTORE_PROJECT_ID/, 'deploy-webhook.yml: FIRESTORE_PROJECT_ID required var check missing');
  assert.match(contents, /LLM_FEATURE_FLAG/, 'deploy-webhook.yml: LLM_FEATURE_FLAG required var check missing');
  assert.match(contents, /OPENAI_MODEL/, 'deploy-webhook.yml: OPENAI_MODEL required var check missing');
  assert.match(contents, /ENABLE_PAID_ORCHESTRATOR_V2/, 'deploy-webhook.yml: ENABLE_PAID_ORCHESTRATOR_V2 required var check missing');
  assert.match(contents, /REDAC_MEMBERSHIP_ID_HMAC_SECRET/, 'deploy-webhook.yml: REDAC_MEMBERSHIP_ID_HMAC_SECRET secret check missing');
  assert.match(contents, /OPENAI_API_KEY/, 'deploy-webhook.yml: OPENAI_API_KEY secret check missing');
  assert.match(contents, /Verify webhook runtime contract/, 'deploy-webhook.yml: runtime contract verify step missing');
  assert.match(contents, /Verify webhook single-region uniqueness \(pre-deploy\)/, 'deploy-webhook.yml: pre-deploy uniqueness guard missing');
  assert.match(contents, /Verify webhook single-region uniqueness \(post-deploy\)/, 'deploy-webhook.yml: post-deploy uniqueness guard missing');
});

test('phase182: deploy-track workflow preflight validates required vars and secrets', () => {
  const contents = read('.github/workflows/deploy-track.yml');
  assertHasPreflightGuard(contents, 'deploy-track.yml');
  assert.match(contents, /FIRESTORE_PROJECT_ID/, 'deploy-track.yml: FIRESTORE_PROJECT_ID required var check missing');
  assert.match(contents, /TRACK_TOKEN_SECRET/, 'deploy-track.yml: TRACK_TOKEN_SECRET secret check missing');
});
