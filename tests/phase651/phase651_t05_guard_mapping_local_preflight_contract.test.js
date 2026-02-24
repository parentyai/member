'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { fetchGuardCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase651: guard normalization maps local preflight credential issues', () => {
  const mapped = fetchGuardCore.normalizeGuardError({ error: 'CREDENTIALS_PATH_INVALID' });
  assert.equal(mapped.tone, 'danger');
  assert.ok(mapped.cause.includes('認証情報'));
  assert.ok(mapped.action.includes('GOOGLE_APPLICATION_CREDENTIALS'));
});

test('phase651: guard normalization maps local preflight unavailable warning', () => {
  const mapped = fetchGuardCore.normalizeGuardError({ error: 'LOCAL_PREFLIGHT_UNAVAILABLE' });
  assert.equal(mapped.tone, 'warn');
  assert.ok(mapped.cause.includes('診断API'));
  assert.ok(mapped.action.includes('/api/admin/local-preflight'));
});
