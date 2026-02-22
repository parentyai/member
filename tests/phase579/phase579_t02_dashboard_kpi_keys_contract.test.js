'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase579: dashboard kpi payload keeps legacy keys and adds engagement/faqUsage', () => {
  const routeSrc = fs.readFileSync('src/routes/admin/osDashboardKpi.js', 'utf8');
  assert.ok(routeSrc.includes('registrations'));
  assert.ok(routeSrc.includes('membership'));
  assert.ok(routeSrc.includes('stepStates'));
  assert.ok(routeSrc.includes('churnRate'));
  assert.ok(routeSrc.includes('ctrTrend'));
  assert.ok(routeSrc.includes('cityPackUsage'));
  assert.ok(routeSrc.includes('engagement'));
  assert.ok(routeSrc.includes('faqUsage'));
  assert.ok(routeSrc.includes('notifications'));
  assert.ok(routeSrc.includes('reaction'));
});
