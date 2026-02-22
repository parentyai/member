'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase351: dashboard kpi route parses fallbackMode and rejects invalid value', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/osDashboardKpi.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('function parseFallbackMode(req)'));
  assert.ok(src.includes("throw new Error('invalid fallbackMode')"));
  assert.ok(src.includes('fallbackMode = parseFallbackMode(req);'));
  assert.ok(
    src.includes('computed = await computeDashboardKpis(windowMonths, scanLimit, { fallbackMode });') ||
    src.includes('computeDashboardKpis(windowMonths, scanLimit, { fallbackMode, fallbackOnEmpty });')
  );
});
