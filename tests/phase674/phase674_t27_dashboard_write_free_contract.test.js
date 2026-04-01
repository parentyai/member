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

function extractBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) return '';
  const end = source.indexOf(endMarker, start + startMarker.length);
  return end === -1 ? source.slice(start) : source.slice(start, end);
}

test('phase674: dashboard keeps write actions out and exposes decision deep links', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  const homePane = extractPaneSection(html, 'home');
  assert.ok(homePane, 'pane-home must exist');

  assert.ok(homePane.includes('id="dashboard-summary-open-alerts"'));
  assert.ok(homePane.includes('id="dashboard-summary-scheduled-today"'));
  assert.ok(homePane.includes('id="dashboard-summary-registered-count"'));

  assert.ok(homePane.includes('id="home-action-alerts"'));
  assert.ok(homePane.includes('data-open-pane="alerts"'));
  assert.ok(homePane.includes('id="home-action-monitor"'));
  assert.ok(homePane.includes('data-open-pane="monitor"'));
  assert.ok(homePane.includes('id="dashboard-link-monitor"'));
  assert.ok(homePane.includes('data-open-pane="monitor"'));
  assert.ok(homePane.includes('id="dashboard-link-read-model"'));
  assert.ok(homePane.includes('data-open-pane="read-model"'));
  assert.ok(homePane.includes('id="dashboard-link-system"'));
  assert.ok(homePane.includes('data-open-pane="ops-system-health"'));

  assert.ok(!homePane.includes('id="home-action-edit"'));
  assert.ok(!homePane.includes('id="home-action-read-model"'));
  assert.ok(!homePane.includes('data-open-pane="composer"'));
  assert.ok(!homePane.includes('data-open-pane="audit"'));
  assert.ok(!homePane.includes('id="home-pane-details"'));
  assert.ok(!homePane.includes('data-legacy-dashboard-details="true"'));
  assert.ok(!homePane.includes('id="dashboard-journey-kpi-result"'));
  assert.ok(homePane.includes('id="home-kpi-details"'));

  const homeActionMap = extractBlock(js, 'const PAGE_HEADER_ACTION_MAP = Object.freeze({', 'const V3_DECISION_CARD_COPY_MAP = Object.freeze({');
  assert.ok(!homeActionMap.includes('home: Object.freeze({'));
  assert.ok(homeActionMap.includes("'city-pack': Object.freeze({"));
  assert.ok(!homeActionMap.includes("paneTarget: 'composer'"));
  assert.ok(js.includes("buttonEl.getAttribute('data-open-pane')"));

  const loadDashboardKpisBody = extractBlock(js, 'async function loadDashboardKpis(options) {', 'function computeTopCauses(');
  assert.ok(!loadDashboardKpisBody.includes('loadDashboardJourneyKpi('));
});
