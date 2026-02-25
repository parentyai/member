'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase664: admin app suppresses generic guard banner for local preflight failures', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(src.includes('function shouldSuppressGenericGuard(rawError)'));
  assert.ok(src.includes('if (shouldSuppressGenericGuard(rawError)) {'));
  assert.ok(src.includes('clearGuardBanner();'));
  assert.ok(src.includes("state.recoveryUx = Object.assign({}, state.recoveryUx, { suppressedGuard: true });"));
});

test('phase664: data load failure guard keeps local preflight banner as single primary banner', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(src.includes('if (state.localPreflight && state.localPreflight.ready === false) {'));
  assert.ok(src.includes('renderLocalPreflightBanner(state.localPreflight);'));
  assert.ok(!src.includes("renderGuardBanner({ error: summary.code || 'LOCAL_PREFLIGHT_NOT_READY' });"));
});
