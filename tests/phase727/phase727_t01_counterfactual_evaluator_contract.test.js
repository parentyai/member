'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateCounterfactualChoice } = require('../../src/domain/llm/bandit/counterfactualEvaluator');

test('phase727: counterfactual evaluator marks opportunity when selected rank is lower and gap exceeds threshold', () => {
  const result = evaluateCounterfactualChoice({
    selectedArmId: 'Coach|cta=1',
    selectedRank: 2,
    selectedScore: 0.61,
    topArms: [
      { rank: 1, armId: 'Checklist|cta=1', score: 0.79 },
      { rank: 2, armId: 'Coach|cta=1', score: 0.61 },
      { rank: 3, armId: 'Weekend|cta=1', score: 0.55 }
    ]
  });

  assert.equal(result.version, 'v1');
  assert.equal(result.eligible, true);
  assert.equal(result.bestArmId, 'Checklist|cta=1');
  assert.equal(result.selectedArmId, 'Coach|cta=1');
  assert.equal(result.scoreGap, 0.18);
  assert.equal(result.opportunityDetected, true);
});

test('phase727: counterfactual evaluator remains non-opportunity for top-ranked selected arm', () => {
  const result = evaluateCounterfactualChoice({
    selectedArmId: 'Checklist|cta=1',
    selectedRank: 1,
    selectedScore: 0.79,
    topArms: [
      { rank: 1, armId: 'Checklist|cta=1', score: 0.79 },
      { rank: 2, armId: 'Coach|cta=1', score: 0.61 }
    ]
  });

  assert.equal(result.eligible, true);
  assert.equal(result.opportunityDetected, false);
  assert.equal(result.scoreGap, 0);
});
