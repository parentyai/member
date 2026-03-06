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

  const school = routeConversation('school enrollment どう進める？', { llmConciergeEnabled: false });
  assert.equal(school.mode, 'problem');
  assert.equal(school.reason, 'school_intent_detected');
  assert.equal(school.conversationMode, 'concierge');

  const ssn = routeConversation('SSN 申請どうする？', { llmConciergeEnabled: false });
  assert.equal(ssn.mode, 'problem');
  assert.equal(ssn.reason, 'ssn_intent_detected');
  assert.equal(ssn.conversationMode, 'concierge');

  const banking = routeConversation('bank account を作りたい', { llmConciergeEnabled: false });
  assert.equal(banking.mode, 'problem');
  assert.equal(banking.reason, 'banking_intent_detected');
  assert.equal(banking.conversationMode, 'concierge');
});

test('phase719: conversation router keeps non-problem modes casual even when concierge enabled', () => {
  assert.equal(routeConversation('税金どうする？', { llmConciergeEnabled: true }).conversationMode, 'casual');
  assert.equal(routeConversation('元気？', { llmConciergeEnabled: true }).conversationMode, 'casual');
});
