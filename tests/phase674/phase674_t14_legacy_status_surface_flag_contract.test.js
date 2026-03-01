'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: legacy status surface flag wires boot/js visibility control', () => {
  const indexSrc = fs.readFileSync('src/index.js', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(indexSrc.includes("resolveBooleanEnvFlag('ENABLE_ADMIN_LEGACY_STATUS_V1', false)"));
  assert.ok(indexSrc.includes('window.ENABLE_ADMIN_LEGACY_STATUS_V1='));

  assert.ok(js.includes('const ADMIN_LEGACY_STATUS_V1 = resolveFrontendFeatureFlag('));
  assert.ok(js.includes('window.ENABLE_ADMIN_LEGACY_STATUS_V1'));
  assert.ok(js.includes("const hideLegacyStatusSurface = !ADMIN_LEGACY_STATUS_V1 || nextRole !== 'developer';"));
  assert.ok(js.includes("document.querySelectorAll('[data-legacy-status-surface=\"1\"]')"));
});
