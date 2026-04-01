'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function extractPaneSection(html, paneId) {
  const marker = `<section id="pane-${paneId}"`;
  const start = html.indexOf(marker);
  if (start === -1) return '';
  const next = html.indexOf('<section id="pane-', start + marker.length);
  return next === -1 ? html.slice(start) : html.slice(start, next);
}

test('phase674: dashboard first view caps itself to six focus tiles and keeps detailed KPI below', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const homePane = extractPaneSection(html, 'home');

  const focusCards = homePane.match(/data-dashboard-focus-card="/g) || [];
  assert.equal(focusCards.length, 6);
  assert.ok(homePane.includes('id="dashboard-focus-registrations-value"'));
  assert.ok(homePane.includes('id="dashboard-focus-proActive-value"'));
  assert.ok(homePane.includes('id="dashboard-focus-notifications-value"'));
  assert.ok(homePane.includes('id="dashboard-focus-reaction-value"'));
  assert.ok(homePane.includes('id="dashboard-focus-llmBlockRate-value"'));
  assert.ok(homePane.includes('id="dashboard-focus-dependencyBlockRate-value"'));
  assert.ok(homePane.includes('id="home-kpi-details"'));
  assert.ok(homePane.includes('class="panel dashboard-panel dashboard-panel-detail"'));

  assert.ok(js.includes('const DASHBOARD_FOCUS_METRICS = Object.freeze(['));
  assert.ok(js.includes('function renderDashboardFocusTiles()'));
  assert.ok(js.includes('function renderDashboardBandVisibility()'));
  assert.ok(js.includes('const DASHBOARD_BAND_METRIC_KEYS = Object.freeze({'));

  assert.ok(css.includes('.dashboard-first-view-grid'));
  assert.ok(css.includes('.dashboard-focus-card'));
  assert.ok(css.includes('.dashboard-kpi-band.is-empty .dashboard-kpi-grid'));
});
