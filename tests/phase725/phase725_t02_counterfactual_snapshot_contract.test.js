'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildCounterfactualSnapshot } = require('../../src/domain/llm/bandit/counterfactualSnapshot');

test('phase725: counterfactual snapshot returns ranked top arms and selected rank', () => {
  const snapshot = buildCounterfactualSnapshot({
    selectedArmId: 'Coach|cta=1',
    maxArms: 3,
    candidates: [
      { armId: 'Checklist|cta=2', styleId: 'Checklist', ctaCount: 2, score: 0.72 },
      { armId: 'Coach|cta=1', styleId: 'Coach', ctaCount: 1, score: 0.61 },
      { armId: 'Weekend|cta=3', styleId: 'Weekend', ctaCount: 3, score: 0.55 },
      { armId: 'Debug|cta=1', styleId: 'Debug', ctaCount: 1, score: 0.31 }
    ]
  });

  assert.equal(snapshot.selectedArmId, 'Coach|cta=1');
  assert.equal(snapshot.selectedRank, 2);
  assert.equal(snapshot.topArms.length, 3);
  assert.equal(snapshot.topArms[0].armId, 'Checklist|cta=2');
  assert.equal(snapshot.topArms[0].rank, 1);
});
