'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase594: read path budgets include missing-index-surface baseline for phase594', () => {
  const file = path.join(process.cwd(), 'docs/READ_PATH_BUDGETS.md');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes('current_baseline_phase594'));
  assert.ok(text.includes('missing_index_surface_max:'));
});

test('phase594: missing index surface generator enforces budget from READ_PATH_BUDGETS', () => {
  const file = path.join(process.cwd(), 'scripts/generate_missing_index_surface.js');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes('missing_index_surface_max'));
  assert.ok(text.includes('missing-index surfaces exceed budget'));
});
