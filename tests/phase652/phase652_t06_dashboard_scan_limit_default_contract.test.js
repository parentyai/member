'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

test('phase652: dashboard scanLimit uses DEFAULT_SCAN_LIMIT when query is missing', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/osDashboardKpi.js'), 'utf8');
  assert.ok(src.includes("const rawParam = url.searchParams.get('scanLimit');"));
  assert.ok(src.includes("if (rawParam === null || rawParam === undefined || rawParam === '') return DEFAULT_SCAN_LIMIT;"));
  assert.ok(src.includes('const raw = Number(rawParam);'));
});
