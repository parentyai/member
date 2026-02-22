'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase326: phase4 users summary route parses limit/analyticsLimit bounds', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/opsOverview.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("const limitRaw = url.searchParams.get('limit');"));
  assert.ok(src.includes("const analyticsLimitRaw = url.searchParams.get('analyticsLimit');"));
  assert.ok(src.includes('const limit = parsePositiveInt(limitRaw, 1, 500);'));
  assert.ok(src.includes('const analyticsLimit = parsePositiveInt(analyticsLimitRaw, 1, 3000);'));
  assert.ok(src.includes('throw new Error(\'invalid limit\')'));
  assert.ok(src.includes('const items = await getUserOperationalSummary({'));
});
