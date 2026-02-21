'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('phase304: dashboard KPI endpoint is wired and returns six KPI keys contract', () => {
  const indexSrc = fs.readFileSync('src/index.js', 'utf8');
  const routeSrc = fs.readFileSync('src/routes/admin/osDashboardKpi.js', 'utf8');
  assert.ok(indexSrc.includes('/api/admin/os/dashboard/kpi'));
  assert.ok(routeSrc.includes('registrations'));
  assert.ok(routeSrc.includes('membership'));
  assert.ok(routeSrc.includes('stepStates'));
  assert.ok(routeSrc.includes('churnRate'));
  assert.ok(routeSrc.includes('ctrTrend'));
  assert.ok(routeSrc.includes('cityPackUsage'));
});

