'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase656: journey kpi/context workflows call internal routes with city-pack token header', () => {
  const kpiWorkflow = read('.github/workflows/journey-kpi-build.yml');
  const snapshotWorkflow = read('.github/workflows/user-context-snapshot-build.yml');

  assert.ok(kpiWorkflow.includes('/internal/jobs/journey-kpi-build'));
  assert.ok(kpiWorkflow.includes('x-city-pack-job-token'));
  assert.ok(kpiWorkflow.includes('CITY_PACK_JOB_TOKEN'));
  assert.ok(kpiWorkflow.includes('workflow_dispatch'));
  assert.ok(kpiWorkflow.includes('schedule:'));

  assert.ok(snapshotWorkflow.includes('/internal/jobs/user-context-snapshot-build'));
  assert.ok(snapshotWorkflow.includes('x-city-pack-job-token'));
  assert.ok(snapshotWorkflow.includes('CITY_PACK_JOB_TOKEN'));
  assert.ok(snapshotWorkflow.includes('workflow_dispatch'));
  assert.ok(snapshotWorkflow.includes('schedule:'));
});

test('phase656: dashboard KPI and llm usage summary include additive retention and decision surfaces', () => {
  const dashboardRoute = read('src/routes/admin/osDashboardKpi.js');
  const usageSummaryRoute = read('src/routes/admin/osLlmUsageSummary.js');
  const adminHtml = read('apps/admin/app.html');
  const adminJs = read('apps/admin/assets/admin_app.js');

  assert.ok(dashboardRoute.includes('journey_retention_d30'));
  assert.ok(dashboardRoute.includes('journey_next_action_execution_rate'));
  assert.ok(dashboardRoute.includes('journey_pro_conversion_rate'));
  assert.ok(dashboardRoute.includes('journey_churn_blocked_ratio'));

  assert.ok(usageSummaryRoute.includes('maskedTopUsers'));
  assert.ok(usageSummaryRoute.includes('byPlan'));
  assert.ok(usageSummaryRoute.includes('byDecision'));

  assert.ok(adminHtml.includes('id="llm-usage-export"'));
  assert.ok(adminJs.includes('exportLlmUsageCsv('));
  assert.ok(adminJs.includes('/api/admin/os/llm-usage/export'));
});
