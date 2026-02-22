'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase355: read path budgets include hotspots_count_max in current baseline', () => {
  const text = fs.readFileSync('docs/READ_PATH_BUDGETS.md', 'utf8');
  assert.ok(text.includes('current_baseline_phase355'));
  assert.ok(text.includes('hotspots_count_max: 23'));
});
