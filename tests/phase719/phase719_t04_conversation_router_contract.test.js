'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { routeConversation } = require('../../src/domain/llm/router/conversationRouter');

test('phase719: conversation router returns mode, reason, and normalized conversationMode', () => {
  const greeting = routeConversation('こんにちは', { llmConciergeEnabled: true });
  assert.deepEqual(greeting, {
    mode: 'greeting',
    reason: 'greeting_detected',
    conversationMode: 'casual'
  });

  const problem = routeConversation('手続きが詰まって進まない', { llmConciergeEnabled: true });
  assert.equal(problem.mode, 'problem');
  assert.equal(problem.reason, 'blocked_signal');
  assert.equal(problem.conversationMode, 'concierge');

  const activity = routeConversation('週末どこ行く？', { llmConciergeEnabled: true });
  assert.equal(activity.mode, 'activity');
  assert.equal(activity.conversationMode, 'casual');

  const housing = routeConversation('部屋探ししたい', { llmConciergeEnabled: false });
  assert.equal(housing.mode, 'problem');
  assert.equal(housing.reason, 'housing_intent_detected');
  assert.equal(housing.conversationMode, 'concierge');
});

test('phase719: conversation router keeps non-problem modes casual even when concierge enabled', () => {
  assert.equal(routeConversation('学校手続きどうする？', { llmConciergeEnabled: true }).conversationMode, 'casual');
  assert.equal(routeConversation('元気？', { llmConciergeEnabled: true }).conversationMode, 'casual');
});
