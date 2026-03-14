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
  assert.equal(broad.strategy, 'clarify');
  assert.equal(broad.strategyReason, 'broad_question_clarify');
  assert.equal(broad.retrieveNeeded, false);

  const housing = buildStrategyPlan({
    routerMode: 'question',
    normalizedConversationIntent: 'housing',
    messageText: '住まい探しって最初に何を見るべきですか？',
    llmFlags: { llmConciergeEnabled: true }
  });
  assert.equal(housing.strategy, 'domain_concierge');
  assert.equal(housing.strategyReason, 'explicit_domain_intent');
  assert.equal(housing.retrieveNeeded, false);
});
