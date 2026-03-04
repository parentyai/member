'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { chooseArm } = require('../../src/domain/llm/bandit/epsilonGreedy');
const { selectActionForConversation } = require('../../src/domain/llm/conversation/actionSelector');

const SAMPLE_CANDIDATES = [
  { armId: 'Coach|cta=1', styleId: 'Coach', ctaCount: 1, score: 0.5, scoreBreakdown: { base: 0.5 } },
  { armId: 'Checklist|cta=2', styleId: 'Checklist', ctaCount: 2, score: 0.45, scoreBreakdown: { base: 0.45 } }
];

test('phase724: epsilon-greedy can explore path', () => {
  const picked = chooseArm(SAMPLE_CANDIDATES, {
    epsilon: 0.5,
    randomFn: () => 0.01,
    stateByArm: {}
  });

  assert.equal(picked.selectionSource, 'bandit_explore');
  assert.ok(picked.selected);
});

test('phase724: epsilon-greedy exploit prefers learned avg reward', () => {
  const picked = chooseArm(SAMPLE_CANDIDATES, {
    epsilon: 0,
    randomFn: () => 0.99,
    stateByArm: {
      'Coach|cta=1': { pulls: 5, avgReward: 0.1 },
      'Checklist|cta=2': { pulls: 5, avgReward: 0.9 }
    }
  });

  assert.equal(picked.selectionSource, 'bandit_exploit');
  assert.equal(picked.selected.armId, 'Checklist|cta=2');
});

test('phase724: action selector marks source as bandit when enabled', () => {
  const selected = selectActionForConversation({
    styleDecision: { styleId: 'Coach', askClarifying: false, maxActions: 2 },
    confidence: { intentConfidence: 0.8, contextConfidence: 0.8 },
    mode: 'A',
    topic: 'general',
    userTier: 'paid',
    messageLength: 30,
    timeOfDay: 12,
    journeyPhase: 'pre',
    riskBucket: 'low',
    evidenceNeed: 'none',
    bandit: {
      enabled: true,
      epsilon: 0,
      randomFn: () => 0.99,
      stateByArm: {
        'Checklist|cta=2': { pulls: 9, avgReward: 0.95 }
      }
    }
  });

  assert.ok(['bandit_exploit', 'bandit_explore'].includes(selected.selectionSource));
});
