'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationPacket } = require('../../src/domain/llm/orchestrator/buildConversationPacket');
const { buildStrategyPlan } = require('../../src/domain/llm/orchestrator/strategyPlanner');
const { judgeNeedRetrieval } = require('../../src/domain/llm/orchestrator/retrievalController');

function resolvePlan(messageText, options) {
  const packet = buildConversationPacket(Object.assign({
    lineUserId: 'U_PHASE731',
    messageText,
    planInfo: { plan: 'pro', status: 'active' },
    paidIntent: 'situation_analysis',
    llmFlags: {
      llmConciergeEnabled: true,
      llmWebSearchEnabled: true,
      llmStyleEngineEnabled: true,
      llmBanditEnabled: false,
      qualityEnabled: true,
      snapshotStrictMode: false
    }
  }, options || {}));
  const plan = buildStrategyPlan(packet);
  return Object.assign(plan, {
    retrieveNeeded: judgeNeedRetrieval(packet, plan)
  });
}

test('phase731: orchestrator strategy keeps greeting/casual retrieval-free', () => {
  const greeting = resolvePlan('こんにちは');
  assert.equal(greeting.strategy, 'casual');
  assert.equal(greeting.conversationMode, 'casual');
  assert.equal(greeting.retrieveNeeded, false);

  const casual = resolvePlan('元気？');
  assert.equal(casual.strategy, 'casual');
  assert.equal(casual.retrieveNeeded, false);
});

test('phase731: orchestrator strategy prefers clarify for broad questions', () => {
  const plan = resolvePlan('何から始めればいい？');
  assert.equal(plan.strategy, 'clarify');
  assert.equal(plan.conversationMode, 'casual');
  assert.equal(plan.retrieveNeeded, false);
  assert.deepEqual(plan.candidateSet, ['clarify_candidate', 'conversation_candidate']);
});

test('phase731: orchestrator strategy forces domain concierge for paid domain intents', () => {
  const domain = resolvePlan('学校手続きどうする？');
  assert.equal(domain.strategy, 'domain_concierge');
  assert.equal(domain.conversationMode, 'concierge');
  assert.equal(domain.retrieveNeeded, false);
});

test('phase731: orchestrator strategy keeps recommendation path retrieval-aware', () => {
  const activity = resolvePlan('週末どこ行く？');
  assert.equal(activity.strategy, 'recommendation');
  assert.equal(activity.retrieveNeeded, true);
  assert.equal(activity.verifyNeeded, true);
});
