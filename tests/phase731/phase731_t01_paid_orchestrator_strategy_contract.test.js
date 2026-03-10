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

test('phase731: orchestrator resumes recent domain context for ambiguous short utterance', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE731',
    messageText: 'ヒザ',
    planInfo: { plan: 'pro', status: 'active' },
    paidIntent: 'situation_analysis',
    llmFlags: {
      llmConciergeEnabled: true
    },
    recentActionRows: [
      {
        createdAt: '2026-03-08T00:00:00.000Z',
        domainIntent: 'school',
        committedFollowupQuestion: '優先したい手続きを1つ教えてください。'
      }
    ]
  });
  const plan = buildStrategyPlan(packet);
  assert.equal(packet.contextResume, true);
  assert.equal(packet.contextResumeDomain, 'school');
  assert.equal(packet.routerReason, 'contextual_domain_resume');
  assert.equal(packet.normalizedConversationIntent, 'school');
  assert.equal(plan.strategy, 'domain_concierge');
  assert.equal(plan.conversationMode, 'concierge');
});

test('phase731: low-information casual without recent domain prefers clarify', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE731',
    messageText: 'ヒザ',
    planInfo: { plan: 'pro', status: 'active' },
    paidIntent: 'situation_analysis',
    llmFlags: {
      llmConciergeEnabled: true
    },
    recentActionRows: []
  });
  const plan = buildStrategyPlan(packet);
  assert.equal(packet.contextResume, false);
  assert.equal(packet.normalizedConversationIntent, 'general');
  assert.equal(plan.strategy, 'clarify');
  assert.equal(plan.fallbackType, 'low_information_clarify');
  assert.deepEqual(plan.candidateSet, ['clarify_candidate', 'conversation_candidate']);
});

test('phase731: recovery signal under domain keeps domain concierge strategy', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE731_RECOVERY',
    messageText: '違う、予約じゃなくて書類',
    planInfo: { plan: 'pro', status: 'active' },
    paidIntent: 'situation_analysis',
    llmFlags: {
      llmConciergeEnabled: true
    },
    recentActionRows: [
      {
        createdAt: '2026-03-08T00:00:00.000Z',
        domainIntent: 'ssn',
        followupIntent: 'appointment_needed'
      }
    ]
  });
  const plan = buildStrategyPlan(packet);
  assert.equal(packet.recoverySignal, true);
  assert.equal(packet.contextResume, true);
  assert.equal(packet.normalizedConversationIntent, 'ssn');
  assert.equal(plan.strategy, 'domain_concierge');
  assert.equal(plan.fallbackType, 'recovery_domain_resume');
});
