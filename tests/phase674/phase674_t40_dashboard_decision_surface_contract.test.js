'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const {
  loadAdminUiDictionaryMap,
  assertDictionaryHasTextKeys,
} = require('../_admin_ui_dictionary_test_helper');

function extractPaneSection(html, paneId) {
  const marker = `<section id="pane-${paneId}"`;
  const start = html.indexOf(marker);
  if (start === -1) return '';
  const next = html.indexOf('<section id="pane-', start + marker.length);
  return next === -1 ? html.slice(start) : html.slice(start, next);
}

test('phase674: dashboard decision surface groups KPIs and keeps one primary action', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const dictMap = loadAdminUiDictionaryMap();
  const homePane = extractPaneSection(html, 'home');

  assert.ok(homePane.includes('id="home-action-alerts"'));
  assert.ok(homePane.includes('id="home-action-monitor"'));
  assert.ok(!homePane.includes('id="home-action-read-model"'));
  assert.ok(homePane.includes('id="home-kpi-details"'));
  assert.ok(homePane.includes('class="dashboard-priority-grid"'));
  assert.ok(homePane.includes('data-v3-ops-hidden="true"'));

  assert.ok(homePane.includes('data-dashboard-band="usage"'));
  assert.ok(homePane.includes('data-dashboard-band="delivery"'));
  assert.ok(homePane.includes('data-dashboard-band="risk"'));
  assert.ok(homePane.includes('class="dashboard-first-view-grid"'));
  assert.ok(homePane.includes('class="panel dashboard-focus-panel"'));
  assert.ok(homePane.includes('class="dashboard-focus-grid"'));
  assert.ok(homePane.includes('class="dashboard-focus-lead"'));
  assert.ok(homePane.includes('class="dashboard-secondary-links"'));
  assert.ok(homePane.includes('id="dashboard-band-usage-empty"'));
  assert.ok(homePane.includes('id="dashboard-band-delivery-empty"'));
  assert.ok(homePane.includes('id="dashboard-band-risk-empty"'));

  assertDictionaryHasTextKeys(dictMap, [
    'ui.label.home.prioritySummary',
    'ui.label.home.primaryMetrics',
    'ui.label.home.todayFocus',
    'ui.label.home.nextDestinations',
    'ui.label.home.band.usage',
    'ui.label.home.band.delivery',
    'ui.label.home.band.risk',
    'ui.label.home.primaryStep',
    'ui.label.home.secondaryStep',
  ]);

  assert.ok(css.includes('.dashboard-secondary-links'));
  assert.ok(css.includes('.dashboard-kpi-band'));
  assert.ok(css.includes('.dashboard-focus-lead'));
  assert.ok(css.includes('.dashboard-focus-grid'));
  assert.ok(css.includes('.dashboard-band-empty'));
  assert.ok(css.includes('.dashboard-priority-grid'));
  assert.ok(css.includes('.dashboard-details-disclosure'));
  assert.ok(css.includes('.app-shell.home-clean-surface-v1[data-view-pane="home"] #home-decision-card .decision-actions'));
});
