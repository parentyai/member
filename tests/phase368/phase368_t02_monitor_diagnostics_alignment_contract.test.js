'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase368: monitor insights response includes source/asOf/freshness and fallback diagnostics', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/monitorInsights.js'), 'utf8');
  assert.ok(src.includes('source: dataSource'));
  assert.ok(src.includes('asOf,'));
  assert.ok(src.includes('freshnessMinutes,'));
  assert.ok(src.includes('fallbackUsed,'));
  assert.ok(src.includes('fallbackBlocked: fallbackBlockedFlag'));
});
