'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase664: local preflight blocking defaults to opt-in flag', () => {
  const indexSrc = fs.readFileSync('src/index.js', 'utf8');
  const appSrc = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(indexSrc.includes("resolveBooleanEnvFlag('ENABLE_ADMIN_LOCAL_PREFLIGHT_BLOCKING_V1', false)"));
  assert.ok(indexSrc.includes('window.ENABLE_ADMIN_LOCAL_PREFLIGHT_BLOCKING_V1='));
  assert.ok(appSrc.includes('const ADMIN_LOCAL_PREFLIGHT_BLOCKING_V1 = resolveFrontendFeatureFlag('));
  assert.ok(appSrc.includes('window.ENABLE_ADMIN_LOCAL_PREFLIGHT_BLOCKING_V1'));
});

test('phase664: blocking path requires both local preflight and blocking flag', () => {
  const appSrc = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(appSrc.includes('ADMIN_LOCAL_PREFLIGHT_ENABLED'));
  assert.ok(appSrc.includes('ADMIN_LOCAL_PREFLIGHT_BLOCKING_V1'));
  assert.ok(appSrc.includes('state.localPreflight.ready === false'));
  assert.ok(appSrc.includes("mode: blocked ? 'degraded' : 'normal'"));
});
