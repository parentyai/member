'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase628: launch checklist includes structure readiness checks', () => {
  const text = fs.readFileSync(path.join(process.cwd(), 'docs/LAUNCH_CHECKLIST.md'), 'utf8');
  assert.ok(text.includes('checks.structureRisk.ok=true'));
  assert.ok(text.includes('structure_risk_freshness_max_hours'));
});

test('phase628: runbook ops includes structure readiness step', () => {
  const text = fs.readFileSync(path.join(process.cwd(), 'docs/RUNBOOK_OPS.md'), 'utf8');
  assert.ok(text.includes('/api/admin/product-readiness'));
  assert.ok(text.includes('checks.structureRisk'));
  assert.ok(text.includes('structure_risk_*'));
});

test('phase628: structure budgets baseline is documented', () => {
  const text = fs.readFileSync(path.join(process.cwd(), 'docs/STRUCTURE_BUDGETS.md'), 'utf8');
  assert.ok(text.includes('current_baseline_phase628'));
  assert.ok(text.includes('legacy_repos_max: 6'));
  assert.ok(text.includes('merge_candidates_max: 6'));
  assert.ok(text.includes('naming_drift_scenario_max: 9'));
  assert.ok(text.includes('unresolved_dynamic_dep_max: 0'));
  assert.ok(text.includes('structure_risk_freshness_max_hours: 24'));
});
