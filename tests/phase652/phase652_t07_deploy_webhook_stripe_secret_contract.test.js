'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase652: deploy-webhook workflow wires STRIPE_WEBHOOK_SECRET in preflight, IAM and deploy', () => {
  const workflow = read('.github/workflows/deploy-webhook.yml');
  assert.ok(workflow.includes('Validate required secrets exist'));
  assert.ok(workflow.includes('STRIPE_WEBHOOK_SECRET'));
  assert.ok(workflow.includes('Ensure runtime SA can access required secrets'));
  assert.ok(workflow.includes('gcloud secrets add-iam-policy-binding'));
  assert.ok(workflow.includes('STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest'));
});
