'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  runLocalPreflight,
  evaluateCredentialsPath,
  evaluateProjectId
} = require('../../tools/admin_local_preflight');

test('phase651: local preflight marks invalid credentials path as not ready', async () => {
  const result = await runLocalPreflight({
    env: {
      GOOGLE_APPLICATION_CREDENTIALS: '/tmp/does-not-exist.json',
      FIRESTORE_PROJECT_ID: ''
    },
    fsApi: {
      statSync() {
        throw new Error('ENOENT');
      }
    },
    probeFirestore: async () => ({
      key: 'firestoreProbe',
      status: 'error',
      code: 'FIRESTORE_CREDENTIALS_ERROR',
      message: 'probe failed'
    })
  });
  assert.equal(result.ok, true);
  assert.equal(result.ready, false);
  assert.equal(result.checks.credentialsPath.status, 'error');
  assert.equal(result.summary.tone, 'danger');
});

test('phase651: local preflight allows ready state when probe succeeds', async () => {
  const result = await runLocalPreflight({
    env: {
      FIRESTORE_PROJECT_ID: 'member-485303'
    },
    fsApi: {
      statSync(filePath) {
        return { isFile: () => filePath === '/tmp/service-account.json' };
      }
    },
    probeFirestore: async () => ({
      key: 'firestoreProbe',
      status: 'ok',
      code: 'FIRESTORE_PROBE_OK',
      message: 'ok'
    })
  });
  assert.equal(result.ok, true);
  assert.equal(result.ready, true);
  assert.equal(result.summary.tone === 'ok' || result.summary.tone === 'warn', true);
});

test('phase651: direct evaluators expose credentials and project-id states', () => {
  const credentials = evaluateCredentialsPath(
    { GOOGLE_APPLICATION_CREDENTIALS: '/tmp/service-account.json' },
    { statSync: () => ({ isFile: () => true }) }
  );
  const project = evaluateProjectId({ FIRESTORE_PROJECT_ID: '' });
  assert.equal(credentials.code, 'CREDENTIALS_PATH_OK');
  assert.equal(project.code, 'FIRESTORE_PROJECT_ID_MISSING');
});
