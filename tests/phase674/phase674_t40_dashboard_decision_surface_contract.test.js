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

test('phase674: dashboard decision surface groups KPIs and keeps one primary action', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const dict = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  const homePane = extractPaneSection(html, 'home');

  assert.ok(homePane.includes('id="home-action-alerts"'));
  assert.ok(!homePane.includes('id="home-action-monitor"'));
  assert.ok(!homePane.includes('id="home-action-read-model"'));

  assert.ok(homePane.includes('data-dashboard-band="usage"'));
  assert.ok(homePane.includes('data-dashboard-band="delivery"'));
  assert.ok(homePane.includes('data-dashboard-band="risk"'));
  assert.ok(homePane.includes('class="dashboard-panel-lead"'));
  assert.ok(homePane.includes('class="dashboard-secondary-links"'));

  assert.ok(dict.includes('"ui.label.home.prioritySummary": "要対応サマリ"'));
  assert.ok(dict.includes('"ui.label.home.primaryMetrics": "判断指標"'));
  assert.ok(dict.includes('"ui.label.home.band.usage": "利用状況"'));
  assert.ok(dict.includes('"ui.label.home.band.delivery": "配信成果"'));
  assert.ok(dict.includes('"ui.label.home.band.risk": "運用リスク"'));

  assert.ok(css.includes('.dashboard-secondary-links'));
  assert.ok(css.includes('.dashboard-kpi-band'));
  assert.ok(css.includes('.dashboard-panel-lead'));
  assert.ok(css.includes('.app-shell.home-clean-surface-v1[data-view-pane="home"] #home-decision-card .decision-actions'));
});
