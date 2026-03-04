'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  buildDeterministicCandidates,
  selectActionForConversation,
  buildSegmentKey
} = require('../../src/domain/llm/conversation/actionSelector');

test('phase724: deterministic selector returns score-based action with fixed shape', () => {
  const result = selectActionForConversation({
    styleDecision: {
      styleId: 'Checklist',
      askClarifying: false,
      maxActions: 3
    },
    confidence: {
      intentConfidence: 0.9,
      contextConfidence: 0.8
    },
    mode: 'B',
    topic: 'visa',
    userTier: 'paid',
    messageLength: 42,
    timeOfDay: 9,
    journeyPhase: 'pre',
    riskBucket: 'high',
    evidenceNeed: 'required',
    bandit: { enabled: false }
  });

  assert.equal(result.selectionSource, 'score');
  assert.ok(result.selected);
  assert.equal(typeof result.selected.styleId, 'string');
  assert.ok(Number.isFinite(Number(result.selected.score)));
  assert.ok(result.selected.scoreBreakdown && typeof result.selected.scoreBreakdown === 'object');
});

test('phase724: forceClarify reduces action breadth and marks questionFlag', () => {
  const candidates = buildDeterministicCandidates({
    styleDecision: {
      styleId: 'Coach',
      askClarifying: true,
      maxActions: 3
    },
    confidence: {
      intentConfidence: 0.3,
      contextConfidence: 0.3
    },
    forceClarify: true,
    mode: 'A',
    topic: 'general',
    userTier: 'free',
    messageLength: 8,
    timeOfDay: 20,
    evidenceNeed: 'none'
  });

  assert.ok(candidates.length >= 1);
  assert.ok(candidates.every((item) => item.questionFlag === true));
  assert.ok(candidates.some((item) => item.ctaCount <= 2));

  const segment = buildSegmentKey({ journeyPhase: 'pre', userTier: 'paid', riskBucket: 'medium' });
  assert.equal(segment, 'pre|paid|medium');
});
