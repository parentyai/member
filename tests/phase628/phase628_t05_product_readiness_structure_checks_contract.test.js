'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase628: product readiness route reads structure risk artifact and exposes checks.structureRisk', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/productReadiness.js'), 'utf8');
  assert.ok(src.includes('STRUCTURE_RISK_PATH'));
  assert.ok(src.includes('parseStructureBudgets'));
  assert.ok(src.includes('readStructureRisk'));
  assert.ok(src.includes('checks: {'));
  assert.ok(src.includes('structureRisk: {'));
  assert.ok(src.includes('structure_risk_missing'));
  assert.ok(src.includes('structure_risk_generated_at_stale'));
});

test('phase628: product readiness enforces structure risk budgets', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/productReadiness.js'), 'utf8');
  assert.ok(src.includes('legacyReposMax'));
  assert.ok(src.includes('mergeCandidatesMax'));
  assert.ok(src.includes('namingDriftScenarioMax'));
  assert.ok(src.includes('unresolvedDynamicDepMax'));
  assert.ok(src.includes('structure_risk_legacy_over_budget'));
  assert.ok(src.includes('structure_risk_merge_candidates_over_budget'));
  assert.ok(src.includes('structure_risk_naming_drift_over_budget'));
  assert.ok(src.includes('structure_risk_unresolved_dynamic_dep_over_budget'));
});
