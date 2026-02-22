'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase583: dashboard route parses fallbackOnEmpty and threads it into KPI computation', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/osDashboardKpi.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('function parseFallbackOnEmpty(req)'));
  assert.ok(src.includes("throw new Error('invalid fallbackOnEmpty')"));
  assert.ok(src.includes('fallbackOnEmpty = parseFallbackOnEmpty(req);'));
  assert.ok(src.includes('computeDashboardKpis(windowMonths, scanLimit, { fallbackMode, fallbackOnEmpty });'));
  assert.ok(src.includes('if (!fallbackBlocked && fallbackOnEmpty) {'));
});

