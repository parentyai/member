'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase327: phase4 notifications route parses limit/eventsLimit bounds', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/opsOverview.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("const limitRaw = url.searchParams.get('limit');"));
  assert.ok(src.includes("const eventsLimitRaw = url.searchParams.get('eventsLimit');"));
  assert.ok(src.includes('const limit = parsePositiveInt(limitRaw, 1, 500);'));
  assert.ok(src.includes('const eventsLimit = parsePositiveInt(eventsLimitRaw, 1, 3000);'));
  assert.ok(src.includes('eventsLimit,'));
});
