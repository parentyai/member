'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase272: non-STEP defaults are fixed to scenario A / week / limit 50', () => {
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes("if (selected !== 'STEP')"));
  assert.ok(js.includes("scenarioEl.value = 'A'"));
  assert.ok(js.includes("stepEl.value = 'week'"));
  assert.ok(js.includes("targetLimitEl.value = '50'"));
  assert.ok(js.includes("return { limit: 50 }"));
});
