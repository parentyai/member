'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

test('phase361: read-path routes include fallback audit actions', () => {
  const opsOverview = read('src/routes/admin/opsOverview.js');
  const dashboard = read('src/routes/admin/osDashboardKpi.js');
  const monitor = read('src/routes/admin/monitorInsights.js');
  const phase5Ops = read('src/routes/phase5Ops.js');
  const phase5State = read('src/routes/phase5State.js');

  assert.ok(opsOverview.includes("'read_path.fallback.users_summary'"));
  assert.ok(opsOverview.includes("'read_path.fallback.notifications_summary'"));
  assert.ok(dashboard.includes("action: 'read_path.fallback.dashboard_kpi'"));
  assert.ok(monitor.includes("action: 'read_path.fallback.monitor_insights'"));
  assert.ok(phase5State.includes("action: 'read_path.fallback.phase5_state'"));
  assert.ok(phase5Ops.includes("'read_path.fallback.users_summary'"));
  assert.ok(phase5Ops.includes("'read_path.fallback.notifications_summary'"));
  assert.ok(opsOverview.includes("action: 'read_path_fallback'"));
  assert.ok(dashboard.includes("action: 'read_path_fallback'"));
  assert.ok(monitor.includes("action: 'read_path_fallback'"));
  assert.ok(phase5State.includes("action: 'read_path_fallback'"));
  assert.ok(phase5Ops.includes("action: 'read_path_fallback'"));
});
