'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('phase856: package exposes quality patrol cycle CLI', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['quality-patrol:cycle'], 'node tools/quality_patrol/run_quality_patrol_cycle.js');
});

test('phase856: quality patrol workflow runs hourly with OIDC auth and artifact upload', () => {
  const workflow = fs.readFileSync('.github/workflows/quality-patrol.yml', 'utf8');

  assert.ok(workflow.includes('cron: "0 * * * *"'));
  assert.ok(workflow.includes('workflow_dispatch:'));
  assert.ok(workflow.includes('google-github-actions/auth@v3'));
  assert.ok(workflow.includes('google-github-actions/setup-gcloud@v3'));
  assert.ok(workflow.includes('create_credentials_file: true'));
  assert.ok(workflow.includes('Prepare Firebase Admin external-account bridge'));
  assert.ok(workflow.includes('Diagnose Firebase Admin bridge'));
  assert.ok(workflow.includes("require('google-auth-library')"));
  assert.ok(workflow.includes("require.resolve('firebase-admin')"));
  assert.ok(workflow.includes("app/credential-internal.js"));
  assert.ok(workflow.includes('id: firebase_bridge'));
  assert.ok(workflow.includes('NODE_OPTIONS: --require=${{ steps.firebase_bridge.outputs.bridge_path }}'));
  assert.ok(workflow.includes('NODE_PATH: ${{ github.workspace }}/node_modules'));
  assert.ok(workflow.includes('QUALITY_PATROL_AUTH_BRIDGE=external_account'));
  assert.ok(workflow.includes('npm install'));
  assert.ok(workflow.includes('npm run quality-patrol:cycle'));
  assert.ok(workflow.includes('actions/upload-artifact@v7'));
  assert.ok(workflow.includes('/tmp/quality_patrol_cycle_*.json'));
  assert.ok(workflow.includes('OPENAI_API_KEY'));
  assert.ok(workflow.includes('FIRESTORE_PROJECT_ID'));
  assert.ok(workflow.includes('LLM_FEATURE_FLAG'));
  assert.ok(workflow.includes('ENABLE_V1_OPENAI_RESPONSES'));
});
