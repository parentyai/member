'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase595: latest read-path budget includes freshness thresholds', () => {
  const text = fs.readFileSync('docs/READ_PATH_BUDGETS.md', 'utf8');
  const match = text.match(/current_baseline_phase594[\s\S]*/);
  const block = match ? match[0] : '';
  const loadRiskFreshness = block.match(/load_risk_freshness_max_hours:\s*(\d+)/);
  const missingIndexFreshness = block.match(/missing_index_surface_freshness_max_hours:\s*(\d+)/);

  assert.ok(block.length > 0);
  assert.ok(loadRiskFreshness, 'missing load_risk_freshness_max_hours');
  assert.ok(missingIndexFreshness, 'missing missing_index_surface_freshness_max_hours');
  assert.ok(Number(loadRiskFreshness[1]) > 0, 'load_risk_freshness_max_hours must be positive');
  assert.ok(Number(missingIndexFreshness[1]) > 0, 'missing_index_surface_freshness_max_hours must be positive');
});
