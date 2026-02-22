'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase368: dashboard KPI responses include unified fallback diagnostics keys', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/osDashboardKpi.js'), 'utf8');
  assert.ok(src.includes('fallbackUsed: false'));
  assert.ok(src.includes('fallbackBlocked: true'));
  assert.ok(src.includes('fallbackSources: []'));
  assert.ok(src.includes('source:'));
});
