'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase579: dashboard UI requests fallbackMode=allow with fallbackOnEmpty=true by default', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes('/api/admin/os/dashboard/kpi?windowMonths='));
  assert.ok(js.includes('fallbackMode=${encodeURIComponent(fallbackMode)}'));
  assert.ok(js.includes('&fallbackOnEmpty=true'));
  assert.ok(js.includes('&snapshotRefresh=${encodeURIComponent(snapshotRefresh)}'));
  assert.ok(js.includes("loadDashboardKpis({ notify: true, forceRefresh: true })"));
  assert.ok(js.includes("if (raw === DASHBOARD_FALLBACK_MODE_BLOCK) return DASHBOARD_FALLBACK_MODE_BLOCK;"));
});
