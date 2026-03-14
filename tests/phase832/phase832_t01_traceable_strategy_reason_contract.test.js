'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildStrategyPlan } = require('../../src/domain/llm/orchestrator/strategyPlanner');

test('phase832: strategy planner exposes traceable strategy reasons for broad and domain flows', () => {
  const broad = buildStrategyPlan({
    routerMode: 'question',
    normalizedConversationIntent: 'general',
    messageText: 'アメリカ赴任の準備って何から始めればいいですか？',
    llmFlags: { llmConciergeEnabled: true }
  });
  assert.equal(broad.strategy, 'grounded_answer');
  assert.equal(broad.strategyReason, 'broad_question_grounding_probe');
  assert.equal(broad.retrieveNeeded, true);
  assert.equal(broad.strategyPriorityVersion, 'v2');
  assert.ok(broad.strategyAlternativeSet.includes('structured_answer'));

  const housing = buildStrategyPlan({
    routerMode: 'question',
    normalizedConversationIntent: 'housing',
    messageText: '住まい探しって最初に何を見るべきですか？',
    llmFlags: { llmConciergeEnabled: true }
  });
  assert.equal(housing.strategy, 'grounded_answer');
  assert.equal(housing.strategyReason, 'explicit_domain_grounded_answer');
  assert.equal(housing.retrieveNeeded, true);
});
