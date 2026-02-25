'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { resolveFirestoreProjectId } = require('../../src/infra/firestore');

test('phase664: resolver prefers FIRESTORE_PROJECT_ID from env', () => {
  let invoked = false;
  const resolved = resolveFirestoreProjectId({
    env: {
      FIRESTORE_PROJECT_ID: 'member-485303',
      GOOGLE_CLOUD_PROJECT: 'fallback-project'
    },
    execFileSync: () => {
      invoked = true;
      return '';
    }
  });
  assert.deepEqual(resolved, { projectId: 'member-485303', source: 'env:FIRESTORE_PROJECT_ID' });
  assert.equal(invoked, false);
});

test('phase664: resolver falls back to gcloud config when env is missing', () => {
  const resolved = resolveFirestoreProjectId({
    env: {},
    execFileSync: () => 'member-485303\n'
  });
  assert.deepEqual(resolved, { projectId: 'member-485303', source: 'gcloud:config.project' });
});

test('phase664: resolver keeps unresolved when gcloud project is unset', () => {
  const resolved = resolveFirestoreProjectId({
    env: {},
    execFileSync: () => '(unset)\n'
  });
  assert.deepEqual(resolved, { projectId: null, source: 'unresolved' });
});
