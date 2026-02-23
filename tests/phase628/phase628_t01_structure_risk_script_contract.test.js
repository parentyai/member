'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase628: structure risk generator emits structure debt summary with budget hooks', () => {
  const file = path.join(process.cwd(), 'scripts/generate_structure_risk.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('structure_risk.json'));
  assert.ok(src.includes('legacy_repos_count'));
  assert.ok(src.includes('merge_candidates_count'));
  assert.ok(src.includes('naming_drift_scenario_count'));
  assert.ok(src.includes('unresolved_dynamic_dep_count'));
  assert.ok(src.includes('legacy_repos_max'));
  assert.ok(src.includes('merge_candidates_max'));
  assert.ok(src.includes('naming_drift_scenario_max'));
  assert.ok(src.includes('unresolved_dynamic_dep_max'));
  assert.ok(src.includes('structure legacy repos exceeds budget'));
});
