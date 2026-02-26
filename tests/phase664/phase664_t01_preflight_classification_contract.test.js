'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runLocalPreflight } = require('../../tools/admin_local_preflight');

test('phase664: local preflight classifies ADC reauth and exposes recovery summary fields', async () => {
  const result = await runLocalPreflight({
    env: { FIRESTORE_PROJECT_ID: 'member-485303' },
    timeoutMs: 100,
    getDb: () => ({
      listCollections: async () => {
        throw new Error('invalid_grant reauth related error invalid_rapt getting metadata from plugin failed');
      }
    })
  });

  assert.equal(result.ready, false);
  assert.equal(result.checks.firestoreProbe.classification, 'ADC_REAUTH_REQUIRED');
  assert.equal(result.summary.code, 'ADC_REAUTH_REQUIRED');
  assert.equal(result.summary.category, 'auth');
  assert.equal(result.summary.recoveryActionCode, 'RUN_ADC_REAUTH');
  assert.equal(result.summary.primaryCheckKey, 'firestoreProbe');
  assert.equal(result.summary.retriable, true);
  assert.ok(Array.isArray(result.summary.recoveryCommands));
  assert.ok(result.summary.recoveryCommands.length >= 2);
  assert.ok(typeof result.summary.rawHint === 'string' && result.summary.rawHint.length > 0);
});

test('phase664: local preflight classifies timeout and exposes timeout recovery action', async () => {
  const result = await runLocalPreflight({
    env: { FIRESTORE_PROJECT_ID: 'member-485303' },
    timeoutMs: 10,
    getDb: () => ({
      listCollections: async () => new Promise(() => {})
    })
  });

  assert.equal(result.ready, false);
  assert.equal(result.checks.firestoreProbe.classification, 'FIRESTORE_TIMEOUT');
  assert.equal(result.summary.code, 'FIRESTORE_TIMEOUT');
  assert.equal(result.summary.recoveryActionCode, 'CHECK_FIRESTORE_TIMEOUT');
  assert.equal(result.summary.retriable, true);
  assert.ok(Array.isArray(result.summary.recoveryCommands));
  assert.ok(result.summary.recoveryCommands.includes('npm run admin:preflight'));
});

test('phase664: local preflight classifies missing project id probe failure as FIRESTORE_PROJECT_ID_ERROR', async () => {
  const result = await runLocalPreflight({
    env: {},
    allowGcloudProjectIdDetect: false,
    timeoutMs: 100,
    getDb: () => ({
      listCollections: async () => {
        throw new Error('Unable to detect a Project Id in the current environment.');
      }
    })
  });

  assert.equal(result.ready, false);
  assert.equal(result.checks.firestoreProbe.code, 'FIRESTORE_PROJECT_ID_ERROR');
  assert.equal(result.checks.firestoreProbe.classification, 'FIRESTORE_PROJECT_ID_ERROR');
  assert.equal(result.summary.code, 'FIRESTORE_PROJECT_ID_ERROR');
  assert.equal(result.summary.category, 'config');
  assert.equal(result.summary.recoveryActionCode, 'SET_FIRESTORE_PROJECT_ID');
  assert.equal(result.summary.primaryCheckKey, 'firestoreProjectId');
  assert.ok(result.summary.recoveryCommands.includes('npm run admin:preflight'));
});

test('phase664: local preflight promotes FIRESTORE_UNKNOWN probe to FIRESTORE_PROJECT_ID_ERROR when project id is missing', async () => {
  const result = await runLocalPreflight({
    env: {},
    allowGcloudProjectIdDetect: false,
    probeFirestore: async () => ({
      key: 'firestoreProbe',
      status: 'error',
      code: 'FIRESTORE_PROJECT_ID_ERROR',
      classification: 'FIRESTORE_UNKNOWN',
      message: 'Firestore read-only probe failed: Unable to detect a Project Id in the current environment.'
    })
  });

  assert.equal(result.ready, false);
  assert.equal(result.checks.firestoreProjectId.code, 'FIRESTORE_PROJECT_ID_MISSING');
  assert.equal(result.checks.firestoreProbe.code, 'FIRESTORE_PROJECT_ID_ERROR');
  assert.equal(result.checks.firestoreProbe.classification, 'FIRESTORE_PROJECT_ID_ERROR');
  assert.equal(result.summary.code, 'FIRESTORE_PROJECT_ID_ERROR');
  assert.equal(result.summary.recoveryActionCode, 'SET_FIRESTORE_PROJECT_ID');
  assert.equal(result.summary.primaryCheckKey, 'firestoreProjectId');
});

test('phase664: local preflight classifies missing firestore database as FIRESTORE_DATABASE_NOT_FOUND', async () => {
  const result = await runLocalPreflight({
    env: { FIRESTORE_PROJECT_ID: 'member-485303' },
    timeoutMs: 100,
    getDb: () => ({
      listCollections: async () => {
        throw new Error('Database not found. The database or project was deleted.');
      }
    })
  });

  assert.equal(result.ready, false);
  assert.equal(result.checks.firestoreProbe.classification, 'FIRESTORE_DATABASE_NOT_FOUND');
  assert.equal(result.summary.code, 'FIRESTORE_DATABASE_NOT_FOUND');
  assert.equal(result.summary.category, 'config');
  assert.equal(result.summary.recoveryActionCode, 'CHECK_FIRESTORE_DATABASE');
  assert.ok(result.summary.recoveryCommands.includes('gcloud firestore databases list --project <your-project-id>'));
});

test('phase664: local preflight resolves project id via resolver fallback when env is missing', async () => {
  const result = await runLocalPreflight({
    resolveProjectId: () => ({ projectId: 'member-485303', source: 'resolver:test' }),
    allowGcloudProjectIdDetect: true,
    timeoutMs: 100,
    getDb: () => ({
      listCollections: async () => []
    })
  });

  assert.equal(result.ready, true);
  assert.equal(result.checks.firestoreProjectId.code, 'FIRESTORE_PROJECT_ID_OK');
  assert.equal(result.checks.firestoreProjectId.value, 'member-485303');
  assert.equal(result.checks.firestoreProjectId.source, 'resolver:test');
});
