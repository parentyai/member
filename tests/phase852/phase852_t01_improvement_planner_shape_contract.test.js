'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { planImprovements } = require('../../src/domain/qualityPatrol/planImprovements');
const { buildRootCauseResult } = require('./phase852_helpers');

test('phase852: improvement planner returns deterministic planner shape', () => {
  const result = planImprovements({
    rootCauseResult: buildRootCauseResult()
  });

  assert.equal(result.planVersion, 'quality_patrol_improvement_plan_v1');
  assert.equal(result.provenance, 'quality_patrol_improvement_planner');
  assert.equal(typeof result.generatedAt, 'string');
  assert.equal(Array.isArray(result.recommendedPr), true);
  assert.equal(result.recommendedPr.length, 1);
  assert.ok(Array.isArray(result.recommendedPr[0].targetFiles));
  assert.ok(Array.isArray(result.recommendedPr[0].rollbackPlan));
});
