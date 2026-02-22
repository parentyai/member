'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase372: read path budgets include current baseline section for phase372', () => {
  const text = fs.readFileSync(path.join(process.cwd(), 'docs/READ_PATH_BUDGETS.md'), 'utf8');
  assert.ok(text.includes('current_baseline_phase372'));
  assert.ok(text.includes('hotspots_count_max'));
});
