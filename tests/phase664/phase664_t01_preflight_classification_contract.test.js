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
