'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase579: dashboard chart renderer exists and target chart nodes are present', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(js.includes('function renderDashboardLineChartSvg('));
  assert.ok(js.includes('dashboard-chart-line'));
  assert.ok(html.includes('dashboard-kpi-registrations-chart'));
  assert.ok(html.includes('dashboard-kpi-membership-chart'));
  assert.ok(html.includes('dashboard-kpi-engagement-chart'));
  assert.ok(html.includes('dashboard-kpi-notifications-chart'));
  assert.ok(html.includes('dashboard-kpi-reaction-chart'));
  assert.ok(html.includes('dashboard-kpi-faq-chart'));
});
