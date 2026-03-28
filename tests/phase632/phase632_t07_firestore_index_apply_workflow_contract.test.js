'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase632: firestore index apply workflow provides manual OIDC remediation path', () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'firestore-indexes-apply.yml');
  const src = fs.readFileSync(workflowPath, 'utf8');
  assert.ok(src.includes('workflow_dispatch:'));
  assert.ok(src.includes('id-token: write'));
  assert.ok(src.includes('google-github-actions/auth@v3'));
  assert.ok(src.includes('google-github-actions/setup-gcloud@v3'));
  assert.ok(src.includes('npm run firestore-indexes:plan -- --project-id "$TARGET_PROJECT_ID"'));
  assert.ok(src.includes('npm run firestore-indexes:apply -- --project-id "$TARGET_PROJECT_ID"'));
  assert.ok(src.includes('npm run firestore-indexes:check -- --project-id "$TARGET_PROJECT_ID"'));
  assert.ok(src.includes('DEPLOY_SA_EMAIL'));
  assert.ok(src.includes('dry_run'));
});
