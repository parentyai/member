'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: maintenance pane exposes integrated overview summary contract', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  [
    'maintenance-overview-panel',
    'maintenance-overview-summary',
    'maintenance-overview-product-status',
    'maintenance-overview-blockers',
    'maintenance-overview-stale',
    'maintenance-overview-fallback',
    'maintenance-overview-missing-index',
    'maintenance-overview-feature-warn',
    'maintenance-overview-open-system-health',
    'maintenance-overview-open-feature-catalog',
    'maintenance-struct-drift-panel',
    'struct-drift-run-dry',
    'struct-drift-run-apply',
    'struct-drift-runs-reload'
  ].forEach((id) => {
    assert.ok(html.includes(`id="${id}"`), `missing maintenance overview id: ${id}`);
  });

  assert.ok(css.includes('.maintenance-overview-metrics'));
  assert.ok(js.includes('function renderMaintenanceOverview()'));
  assert.ok(js.includes('const missingIndexSurfaceCountRaw = state.missingIndexSurfaceMeta'));
  assert.ok(js.includes('const missingIndexCount = Number.isFinite(missingIndexSurfaceCountRaw)'));
  assert.ok(js.includes('function resolveMaintenanceTraceId(preferredTraceId)'));
  assert.ok(js.includes("document.getElementById('maintenance-overview-open-system-health')?.addEventListener('click'"));
  assert.ok(js.includes("document.getElementById('maintenance-overview-open-feature-catalog')?.addEventListener('click'"));
  assert.ok(js.includes("document.getElementById('struct-drift-run-dry')?.addEventListener('click', () => {"));
  assert.ok(js.includes("document.getElementById('struct-drift-run-apply')?.addEventListener('click', () => {"));
});
