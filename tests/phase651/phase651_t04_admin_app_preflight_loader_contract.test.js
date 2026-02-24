'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase651: admin app wires local preflight feature flag and loader', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(src.includes('const ADMIN_LOCAL_PREFLIGHT_ENABLED = resolveFrontendFeatureFlag('));
  assert.ok(src.includes('window.ENABLE_ADMIN_LOCAL_PREFLIGHT_V1'));
  assert.ok(src.includes('async function loadLocalPreflight(options)'));
  assert.ok(src.includes("fetch('/api/admin/local-preflight'"));
  assert.ok(src.includes('await loadLocalPreflight({ notify: false });'));
});

test('phase651: major loaders use shared failure guard path', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(src.includes("renderDataLoadFailureGuard('alerts_summary_failed'"));
  assert.ok(src.includes("renderDataLoadFailureGuard('dashboard_kpi_failed'"));
  assert.ok(src.includes("renderDataLoadFailureGuard('snapshot_health_failed'"));
  assert.ok(src.includes("renderDataLoadFailureGuard('product_readiness_failed'"));
  assert.ok(src.includes("renderDataLoadFailureGuard('city_pack_kpi_failed'"));
});
