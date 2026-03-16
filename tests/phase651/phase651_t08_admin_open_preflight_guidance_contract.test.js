'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const {
  buildAdminOpenPreflightAdvice,
  shouldAbortAdminOpenFromPreflightAdvice,
  formatBlockingAdminOpenPreflightMessage
} = require('../../tools/admin_open');
const { runLocalPreflight } = require('../../tools/admin_local_preflight');

test('phase651: preflight summary exposes operator branch/hint for SA key required', async () => {
  const result = await runLocalPreflight({
    env: {
      FIRESTORE_PROJECT_ID: 'member-485303',
      ENABLE_ADMIN_LOCAL_PREFLIGHT_STRICT_SA_V1: '1'
    },
    probeFirestore: async () => ({
      key: 'firestoreProbe',
      status: 'ok',
      code: 'FIRESTORE_PROBE_OK',
      message: 'ok'
    })
  });

  assert.equal(result.summary.code, 'SA_KEY_REQUIRED');
  assert.equal(result.summary.operatorBranch, 'AUTH_SA_KEY');
  assert.ok(String(result.summary.operatorHint || '').includes('GOOGLE_APPLICATION_CREDENTIALS'));
});

test('phase651: admin_open guidance maps ADC reauth and provides actionable next command', () => {
  const advice = buildAdminOpenPreflightAdvice({
    ready: false,
    summary: {
      code: 'ADC_REAUTH_REQUIRED',
      cause: 'ADC認証が期限切れです。',
      action: 'ADC再認証を実施してください。',
      recoveryCommands: [
        '# fallback',
        'gcloud auth application-default login',
        'npm run admin:preflight'
      ]
    }
  });

  assert.equal(advice.ready, false);
  assert.equal(advice.code, 'ADC_REAUTH_REQUIRED');
  assert.equal(advice.operatorBranch, 'AUTH_ADC');
  assert.ok(String(advice.operatorHint || '').includes('ADC'));
  assert.equal(advice.nextCommand, 'npm run admin:preflight');
});

test('phase651: admin_open treats FIRESTORE_SDK_MISSING as blocking and prints recovery command', () => {
  const advice = buildAdminOpenPreflightAdvice({
    ready: false,
    summary: {
      code: 'FIRESTORE_SDK_MISSING',
      cause: 'firebase-admin 依存が見つかりません。',
      action: '依存関係を復旧（npm ci）してから再診断してください。',
      recoveryCommands: [
        'npm ci',
        'npm run admin:preflight'
      ]
    }
  });

  assert.equal(shouldAbortAdminOpenFromPreflightAdvice(advice), true);
  assert.match(formatBlockingAdminOpenPreflightMessage(advice), /admin:open を中止しました。/);
  assert.match(formatBlockingAdminOpenPreflightMessage(advice), /npm ci/);
});

test('phase651: admin_open source keeps unified preflight and operator-friendly failure guidance logs', () => {
  const src = fs.readFileSync('tools/admin_open.js', 'utf8');
  assert.ok(src.includes('[admin:open] preflight.${label} code='));
  assert.ok(src.includes('token copy failed ('));
  assert.ok(src.includes('existing server health check failed ('));
  assert.ok(src.includes('buildAdminOpenPreflightAdvice'));
  assert.ok(src.includes('shouldAbortAdminOpenFromPreflightAdvice'));
  assert.ok(src.includes('formatBlockingAdminOpenPreflightMessage'));
});
