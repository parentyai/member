'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase362: read path budgets include current baseline section for phase362', () => {
  const text = fs.readFileSync('docs/READ_PATH_BUDGETS.md', 'utf8');
  assert.ok(text.includes('current_baseline_phase362'));
  assert.ok(text.includes('hotspots_count_max'));
});

