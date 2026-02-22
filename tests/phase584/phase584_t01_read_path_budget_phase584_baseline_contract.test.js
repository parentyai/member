'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase584: read path budgets include current baseline section for phase584', () => {
  const file = path.join(process.cwd(), 'docs/READ_PATH_BUDGETS.md');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes('current_baseline_phase584'));
  assert.ok(text.includes('worst_case_docs_scan_max:'));
  assert.ok(text.includes('fallback_points_max:'));
  assert.ok(text.includes('hotspots_count_max:'));
});

