'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase350: read path budgets include current baseline ratchet values', () => {
  const text = fs.readFileSync('docs/READ_PATH_BUDGETS.md', 'utf8');
  assert.ok(text.includes('current_baseline_phase350'));
  assert.ok(text.includes('worst_case_docs_scan_max: 23000'));
  assert.ok(text.includes('fallback_points_max: 22'));
});
