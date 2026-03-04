'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  scoreConversationConfidence,
  INTENT_CONFIDENCE_THRESHOLD,
  CONTEXT_CONFIDENCE_THRESHOLD
} = require('../../src/domain/llm/conversation/confidenceScorer');

test('phase724: low confidence forces CLARIFY by contract thresholds', () => {
  const scored = scoreConversationConfidence({
    question: 'help',
    topic: 'general',
    mode: 'A',
    blockedReasons: ['provider_error'],
    contextSnapshot: null
  });

  assert.equal(typeof scored.intentConfidence, 'number');
  assert.equal(typeof scored.contextConfidence, 'number');
  assert.equal(scored.forceClarify, true);
  assert.equal(scored.thresholds.intentConfidence, INTENT_CONFIDENCE_THRESHOLD);
  assert.equal(scored.thresholds.contextConfidence, CONTEXT_CONFIDENCE_THRESHOLD);
});

test('phase724: clear regulated query with context can avoid forced clarify', () => {
  const scored = scoreConversationConfidence({
    question: 'visa renewal deadline and required documents in my city',
    topic: 'visa',
    mode: 'B',
    blockedReasons: [],
    contextSnapshot: {
      phase: 'pre',
      topTasks: [{ key: 'visa_renewal', status: 'open', due: '2030-01-01T00:00:00.000Z' }],
      blockedTask: null,
      dueSoonTask: null,
      updatedAt: new Date().toISOString()
    }
  });

  assert.ok(scored.intentConfidence >= 0.6);
  assert.ok(scored.contextConfidence >= 0.55);
  assert.equal(scored.forceClarify, false);
});
