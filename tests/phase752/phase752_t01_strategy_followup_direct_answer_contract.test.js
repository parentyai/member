'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildStrategyPlan } = require('../../src/domain/llm/orchestrator/strategyPlanner');

test('phase752: followup intent on domain prefers grounded answer before domain concierge in casual route', () => {
  const plan = buildStrategyPlan({
    routerMode: 'casual',
    normalizedConversationIntent: 'school',
    followupIntent: 'docs_required',
    contextResume: true,
    llmFlags: { llmConciergeEnabled: true }
  });

  assert.equal(plan.strategy, 'grounded_answer');
  assert.equal(plan.conversationMode, 'concierge');
  assert.equal(plan.directAnswerFirst, true);
  assert.equal(plan.clarifySuppressed, true);
  assert.equal(plan.fallbackType, 'followup_grounding_probe');
});

test('phase752: followup intent on domain forces domain_concierge direct-answer-first in question route', () => {
  const plan = buildStrategyPlan({
    routerMode: 'question',
    normalizedConversationIntent: 'ssn',
    followupIntent: 'appointment_needed',
    contextResume: false,
    llmFlags: { llmConciergeEnabled: true }
  });

  assert.equal(plan.strategy, 'domain_concierge');
  assert.equal(plan.conversationMode, 'concierge');
  assert.equal(plan.directAnswerFirst, true);
  assert.equal(plan.clarifySuppressed, true);
  assert.equal(plan.fallbackType === null || plan.fallbackType === 'followup_direct_answer', true);
});

test('phase752: general followup planning prompt prefers domain concierge direct answer', () => {
  const plan = buildStrategyPlan({
    routerMode: 'question',
    normalizedConversationIntent: 'general',
    followupIntent: 'next_step',
    messageText: 'それなら最初の5分は何をする？',
    llmFlags: { llmConciergeEnabled: true }
  });

  assert.equal(plan.strategy, 'domain_concierge');
  assert.equal(plan.retrieveNeeded, false);
  assert.equal(plan.directAnswerFirst, true);
  assert.equal(plan.clarifySuppressed, true);
  assert.equal(plan.fallbackType, 'general_followup_direct_answer');
});

test('phase752: service plan difference question prefers direct answer without retrieval', () => {
  const plan = buildStrategyPlan({
    routerMode: 'question',
    normalizedConversationIntent: 'general',
    messageText: '無料プランと有料プランの違いを短く教えて。',
    llmFlags: { llmConciergeEnabled: true }
  });

  assert.equal(plan.strategy, 'domain_concierge');
  assert.equal(plan.retrieveNeeded, false);
  assert.equal(plan.directAnswerFirst, true);
  assert.equal(plan.fallbackType, 'service_plan_direct_answer');
});

test('phase752: mixed housing and school question prefers concierge direct answer', () => {
  const plan = buildStrategyPlan({
    routerMode: 'question',
    normalizedConversationIntent: 'housing',
    messageText: '引っ越しと学校の手続きが同時に不安。まず何から確認すべきか順番だけ教えて。',
    followupIntent: 'next_step',
    llmFlags: { llmConciergeEnabled: true }
  });

  assert.equal(plan.strategy, 'domain_concierge');
  assert.equal(plan.retrieveNeeded, false);
  assert.equal(plan.directAnswerFirst, true);
  assert.equal(plan.fallbackType, 'mixed_domain_direct_answer');
});

test('phase752: general kickoff question probes grounding before fallback on broad setup asks', () => {
  const plan = buildStrategyPlan({
    routerMode: 'question',
    normalizedConversationIntent: 'general',
    messageText: 'アメリカ赴任の準備って何から始めればいいですか？',
    llmFlags: { llmConciergeEnabled: true }
  });

  assert.equal(plan.strategy, 'grounded_answer');
  assert.equal(plan.retrieveNeeded, true);
  assert.equal(plan.verifyNeeded, true);
  assert.equal(plan.directAnswerFirst, false);
  assert.equal(plan.clarifySuppressed, false);
  assert.equal(plan.fallbackType, null);
  assert.equal(plan.strategyReason, 'broad_question_grounding_probe');
  assert.equal(plan.fallbackPriorityReason, 'structured_before_clarify');
  assert.deepEqual(plan.candidateSet, [
    'structured_answer_candidate',
    'grounded_candidate',
    'domain_concierge_candidate',
    'clarify_candidate'
  ]);
});

test('phase752: utility transform prompt prefers direct answer on contextual followup', () => {
  const plan = buildStrategyPlan({
    routerMode: 'question',
    normalizedConversationIntent: 'ssn',
    messageText: 'さっきの説明を、家族に送れる一文にして。',
    contextResume: true,
    llmFlags: { llmConciergeEnabled: true }
  });

  assert.equal(plan.strategy, 'domain_concierge');
  assert.equal(plan.retrieveNeeded, false);
  assert.equal(plan.directAnswerFirst, true);
  assert.equal(plan.fallbackType, 'utility_transform_direct_answer');
});

test('phase752: ssn-vs-banking compare question prefers mixed direct answer', () => {
  const plan = buildStrategyPlan({
    routerMode: 'question',
    normalizedConversationIntent: 'ssn',
    messageText: 'SSNと銀行口座の手続き、先にどっちを進めるべきか理由つきで短く教えて。',
    llmFlags: { llmConciergeEnabled: true }
  });

  assert.equal(plan.strategy, 'domain_concierge');
  assert.equal(plan.retrieveNeeded, false);
  assert.equal(plan.directAnswerFirst, true);
  assert.equal(plan.fallbackType, 'mixed_domain_direct_answer');
});

test('phase752: rewrite-only request keeps direct-answer shape and suppresses clarify path', () => {
  const plan = buildStrategyPlan({
    routerMode: 'question',
    normalizedConversationIntent: 'general',
    messageText: '今の文面を、断定しすぎない言い方に直して。',
    llmFlags: { llmConciergeEnabled: true }
  });

  assert.equal(plan.strategy, 'domain_concierge');
  assert.equal(plan.retrieveNeeded, false);
  assert.equal(plan.directAnswerFirst, true);
  assert.equal(plan.clarifySuppressed, true);
  assert.equal(plan.fallbackType, 'utility_transform_direct_answer');
});

test('phase752: recovery correction on domain route stays concierge-first and avoids clarify fallback', () => {
  const plan = buildStrategyPlan({
    routerMode: 'question',
    normalizedConversationIntent: 'school',
    messageText: 'それは違う。学校じゃなくて住まい優先で考え直して。',
    recoverySignal: true,
    llmFlags: { llmConciergeEnabled: true }
  });

  assert.equal(plan.strategy, 'domain_concierge');
  assert.equal(plan.retrieveNeeded, false);
  assert.equal(plan.directAnswerFirst, true);
  assert.equal(plan.clarifySuppressed, true);
  assert.equal(
    plan.fallbackType === 'recovery_domain_resume'
      || plan.fallbackType === 'mixed_domain_direct_answer',
    true
  );
});
