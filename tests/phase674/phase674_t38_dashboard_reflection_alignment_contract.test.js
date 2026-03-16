'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: dashboard reflection uses visible card windows instead of only the summary window', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes('function countVisibleDashboardAvailableMetrics() {'));
  assert.ok(js.includes('const payload = resolveDashboardPayload(getDashboardWindowMonths(metricKey));'));
  assert.ok(js.includes("if (key === 'home') {\n    return countVisibleDashboardAvailableMetrics() > 0;\n  }"));
  assert.ok(js.includes('const availableCount = countVisibleDashboardAvailableMetrics();'));
});
