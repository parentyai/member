'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase638: admin app bootstrap script exposes build meta and rollout flags', () => {
  const src = fs.readFileSync('src/index.js', 'utf8');
  assert.ok(src.includes('function buildAdminAppBootScript()'));
  assert.ok(src.includes('window.ADMIN_APP_BUILD_META='));
  assert.ok(src.includes('window.ENABLE_ADMIN_BUILD_META='));
  assert.ok(src.includes('window.ADMIN_NAV_ROLLOUT_V1='));
  assert.ok(src.includes('window.ADMIN_ROLE_PERSIST_V1='));
  assert.ok(src.includes('window.ADMIN_HISTORY_SYNC_V1='));
});

test('phase638: topbar includes build meta badge shell', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  assert.ok(html.includes('id="topbar-build-meta"'));
  assert.ok(html.includes('id="topbar-build-meta-value"'));
  assert.ok(html.includes('data-dict-key="ui.label.build.meta"'));
  assert.ok(css.includes('.build-meta-badge'));
});
