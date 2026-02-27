'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase671: admin app includes ops-only nav groups and realtime snapshot panes', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(html.includes('data-nav-group="run"'));
  assert.ok(html.includes('data-nav-group="control"'));
  assert.ok(html.includes('data-pane-target="ops-feature-catalog"'));
  assert.ok(html.includes('data-pane-target="ops-system-health"'));
  assert.ok(html.includes('id="ops-home-dashboard"'));
  assert.ok(html.includes('id="ops-home-reload"'));
  assert.ok(html.includes('id="ops-home-rebuild"'));
  assert.ok(html.includes('id="ops-feature-catalog-rows"'));
  assert.ok(html.includes('id="ops-system-health-rows"'));
  assert.ok(html.includes('id="page-last-updated"'));
  assert.ok(html.includes('data-ops-role="developer"'));

  assert.ok(js.includes('ENABLE_ADMIN_OPS_ONLY_NAV_V1'));
  assert.ok(js.includes('ENABLE_ADMIN_DEVELOPER_SURFACE_V1'));
  assert.ok(js.includes('ENABLE_OPS_REALTIME_DASHBOARD_V1'));
  assert.ok(js.includes('ENABLE_OPS_SYSTEM_SNAPSHOT_V1'));
  assert.ok(js.includes('function loadOpsSnapshotBundle(options)'));
  assert.ok(js.includes('function rebuildOpsSystemSnapshot()'));
  assert.ok(js.includes('if (!ADMIN_DEVELOPER_SURFACE_V1 && value.startsWith(\'developer-\')) return \'home\';'));
  assert.ok(js.includes("if (!isOpsRealtimeSnapshotEnabled() && (value === 'ops-feature-catalog' || value === 'ops-system-health')) return 'home';"));
  assert.ok(js.includes('function applyOpsOnlyChrome(role)'));

  assert.ok(css.includes('.app-shell[data-ops-only-nav="1"] [data-ops-nav-legacy="1"]'));
  assert.ok(css.includes('.app-shell[data-hide-developer-role="1"] .role-btn[data-role-value="developer"]'));
  assert.ok(css.includes('.ops-status-grid'));
  assert.ok(css.includes('.ops-status-card[data-status="ALERT"]'));
});
