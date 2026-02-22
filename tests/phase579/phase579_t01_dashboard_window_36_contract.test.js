'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase579: dashboard kpi route accepts windowMonths=36 with backward-compatible windows', () => {
  const routeSrc = fs.readFileSync('src/routes/admin/osDashboardKpi.js', 'utf8');
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(routeSrc.includes('new Set([1, 3, 6, 12, 36])'));
  assert.ok(routeSrc.includes('Math.min(36'));
  assert.ok(html.includes('option value="36"'));
});
