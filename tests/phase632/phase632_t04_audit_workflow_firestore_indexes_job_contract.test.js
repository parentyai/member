'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase632: audit workflow includes firestore-indexes job with OIDC auth and check command', () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'audit.yml');
  const src = fs.readFileSync(workflowPath, 'utf8');
  assert.ok(src.includes('id-token: write'));
  assert.ok(src.includes('firestore-indexes:'));
  assert.ok(src.includes('name: firestore-indexes'));
  assert.ok(src.includes('google-github-actions/auth@v2'));
  assert.ok(src.includes('google-github-actions/setup-gcloud@v2'));
  assert.ok(src.includes('npm run firestore-indexes:check -- --project-id "${FIRESTORE_PROJECT_ID:-$GCP_PROJECT_ID}"'));
});
