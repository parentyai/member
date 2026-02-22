'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase328: phase5 state summary route parses analyticsLimit bounds', () => {
  const file = path.join(process.cwd(), 'src/routes/phase5State.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("const analyticsLimitRaw = url.searchParams.get('analyticsLimit');"));
  assert.ok(src.includes('const analyticsLimit = parsePositiveInt(analyticsLimitRaw, 1, 3000);'));
  assert.ok(src.includes("if (analyticsLimitRaw && !analyticsLimit)"));
  assert.ok(src.includes("throw new Error('invalid limit')"));
});
