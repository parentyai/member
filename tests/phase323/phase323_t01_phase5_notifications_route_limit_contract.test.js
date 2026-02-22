'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase323: phase5 notifications summary route parses limit/eventsLimit bounds', () => {
  const src = fs.readFileSync('/Users/parentyai.com/Projects/Member/src/routes/phase5Ops.js', 'utf8');
  assert.ok(src.includes("const limitRaw = url.searchParams.get('limit');"));
  assert.ok(src.includes("const eventsLimitRaw = url.searchParams.get('eventsLimit');"));
  assert.ok(src.includes('const limit = parsePositiveInt(limitRaw, 1, 500);'));
  assert.ok(src.includes('const eventsLimit = parsePositiveInt(eventsLimitRaw, 1, 3000);'));
});

