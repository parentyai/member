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

test('phase881: home and alerts surfaces stay task-first in ops ui v3', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const dict = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  const ssot = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');

  const homePane = extractPaneSection(html, 'home');
  const alertsPane = extractPaneSection(html, 'alerts');

  assert.ok(homePane.includes('id="home-action-alerts"'));
  assert.ok(homePane.includes('id="home-action-monitor"'));
  assert.ok(homePane.includes('id="dashboard-summary-primary-task"'));
  assert.ok(homePane.includes('id="dashboard-summary-secondary-task"'));
  assert.ok(homePane.includes('id="home-kpi-details"'));
  assert.ok(homePane.includes('data-admin-fold-allowed="true"'));

  assert.ok(alertsPane.includes('id="alerts-decision-card"'));
  assert.ok(alertsPane.includes('id="alerts-action-open"'));
  assert.ok(alertsPane.includes('id="alerts-action-reload"'));
  assert.ok(alertsPane.includes('id="alerts-priority-open-count"'));
  assert.ok(alertsPane.includes('id="alerts-priority-next-step"'));

  assert.ok(js.includes('function resolveHomeTaskSummary()'));
  assert.ok(js.includes('function resolveAlertsDecisionVm()'));
  assert.ok(js.includes("document.getElementById('alerts-action-reload')?.addEventListener('click'"));
  assert.ok(js.includes("renderDecisionCard('alerts', resolveAlertsDecisionVm());"));

  assert.ok(css.includes('.dashboard-priority-grid'));
  assert.ok(css.includes('.dashboard-details-disclosure'));
  assert.ok(css.includes('.alerts-first-view-grid'));
  assert.ok(css.includes('.alerts-priority-grid'));

  assert.ok(dict.includes('"ui.label.v3.decision.home.title": "最初にやることを決める"'));
  assert.ok(dict.includes('"ui.label.v3.decision.alerts.title": "最初の案件から着手する"'));
  assert.ok(dict.includes('"ui.label.home.prioritySummary": "最初にやること"'));
  assert.ok(dict.includes('"ui.label.alerts.prioritySummary": "優先順位サマリ"'));

  assert.ok(ssot.includes('## Home / Alerts Task-First Surface（Phase881 add-only）'));
});
