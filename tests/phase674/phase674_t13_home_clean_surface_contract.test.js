'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: home clean surface flag wires boot/js/css declutter controls', () => {
  const indexSrc = fs.readFileSync('src/index.js', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(indexSrc.includes("resolveBooleanEnvFlag('ENABLE_ADMIN_HOME_CLEAN_SURFACE_V1', true)"));
  assert.ok(indexSrc.includes('window.ENABLE_ADMIN_HOME_CLEAN_SURFACE_V1='));

  assert.ok(js.includes('const ADMIN_HOME_CLEAN_SURFACE_V1 = resolveFrontendFeatureFlag('));
  assert.ok(js.includes('window.ENABLE_ADMIN_HOME_CLEAN_SURFACE_V1'));
  assert.ok(js.includes("appShell.classList.toggle('home-clean-surface-v1', ADMIN_HOME_CLEAN_SURFACE_V1);"));

  assert.ok(css.includes('.app-shell.home-clean-surface-v1 #header-readonly-note'));
  assert.ok(css.includes('.app-shell.home-clean-surface-v1 .top-developer'));
  assert.ok(css.includes('.app-shell.home-clean-surface-v1 #admin-guard-banner'));
  assert.ok(css.includes('.app-shell.home-clean-surface-v1 #ops-home-dashboard'));
  assert.ok(css.includes('.app-shell.home-clean-surface-v1 .dashboard-journey-panel'));
});
