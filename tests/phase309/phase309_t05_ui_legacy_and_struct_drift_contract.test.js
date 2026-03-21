'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

function extractPaneSection(html, paneId) {
  const marker = `<section id="pane-${paneId}"`;
  const start = html.indexOf(marker);
  if (start === -1) return '';
  const next = html.indexOf('<section id="pane-', start + marker.length);
  return next === -1 ? html.slice(start) : html.slice(start, next);
}

test('phase309: review legacy page exposes LEGACY guidance to /admin/app', () => {
  const html = fs.readFileSync('apps/admin/review.html', 'utf8');
  assert.ok(html.includes('LEGACY画面です'));
  assert.ok(html.includes('/admin/app?pane=audit'));
});

test('phase309: admin app relocates struct drift controls into maintenance and keeps handlers', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const maintenancePane = extractPaneSection(html, 'maintenance');
  const auditPane = extractPaneSection(html, 'audit');

  assert.ok(maintenancePane.includes('struct-drift-run-dry'));
  assert.ok(maintenancePane.includes('struct-drift-run-apply'));
  assert.ok(maintenancePane.includes('struct-drift-runs-rows'));
  assert.ok(maintenancePane.includes('maintenance-struct-drift-panel'));
  assert.ok(!auditPane.includes('struct-drift-run-dry'));
  assert.ok(!auditPane.includes('struct-drift-run-apply'));
  assert.ok(js.includes('runStructDriftBackfill('));
  assert.ok(js.includes('loadStructDriftRuns('));
});
