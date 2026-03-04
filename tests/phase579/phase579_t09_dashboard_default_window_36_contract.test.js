'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('phase579: dashboard default window is 36 months', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'apps/admin/assets/admin_app.js'), 'utf8');
  assert.ok(src.includes('const DASHBOARD_DEFAULT_WINDOW = 36;'));
  assert.ok(src.includes("out[metricKey] = String(DASHBOARD_DEFAULT_WINDOW);"));
  assert.ok(src.includes("resolveListStateFromPersistence('dashboardWindowV2', readDashboardWindowState())"));
  assert.ok(src.includes("persistListStateToStorage('dashboardWindowV2', readDashboardWindowState())"));
});
