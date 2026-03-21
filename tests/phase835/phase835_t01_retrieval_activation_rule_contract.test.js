'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveRetrievalDecision } = require('../../src/domain/llm/orchestrator/retrievalController');

test('phase835: retrieval activates for non-general domain even under domain concierge strategy', () => {
  const result = resolveRetrievalDecision({
    messageText: '住まい探しって何から始めればいいですか？',
    normalizedConversationIntent: 'housing',
    genericFallbackSlice: 'housing',
    followupResolvedFromHistory: false
  }, {
    strategy: 'domain_concierge',
    strategyReason: 'explicit_domain_grounded_answer'
  });

  assert.equal(result.retrieveNeeded, true);
  assert.equal(result.retrievalBlockedByStrategy, false);
  assert.match(result.retrievalPermitReason || '', /domain_intent_activation/);
});

test('phase835: retrieval activates for broad questions and history follow-up under blocked strategies', () => {
  const broadResult = resolveRetrievalDecision({
    messageText: 'アメリカ赴任の準備って何から始めればいいですか？',
    normalizedConversationIntent: 'general',
    genericFallbackSlice: 'broad',
    followupResolvedFromHistory: false
  }, {
    strategy: 'clarify',
    strategyReason: 'broad_question_grounding_probe'
  });

  const followupResult = resolveRetrievalDecision({
    messageText: 'それってどのタイミングでやるのがいいですか？',
    normalizedConversationIntent: 'general',
    genericFallbackSlice: 'followup',
    followupResolvedFromHistory: true
  }, {
    strategy: 'clarify',
    strategyReason: 'followup_grounding_first'
  });

  assert.equal(broadResult.retrieveNeeded, true);
  assert.equal(broadResult.retrievalBlockedByStrategy, false);
  assert.match(broadResult.retrievalPermitReason || '', /broad_question_activation/);

  assert.equal(followupResult.retrieveNeeded, true);
  assert.equal(followupResult.retrievalBlockedByStrategy, false);
  assert.match(followupResult.retrievalPermitReason || '', /followup_history_activation/);
});

test('phase835: service plan direct answer fallback keeps retrieval disabled', () => {
  const result = resolveRetrievalDecision({
    messageText: '無料プランと有料プランの違いを、回りくどくなく短く教えて。',
    normalizedConversationIntent: 'general',
    genericFallbackSlice: 'broad',
    followupResolvedFromHistory: false,
    followupIntent: ''
  }, {
    strategy: 'domain_concierge',
    strategyReason: 'service_plan_direct_answer',
    fallbackType: 'service_plan_direct_answer'
  });

  assert.equal(result.retrieveNeeded, false);
  assert.equal(result.retrievalBlockedByStrategy, true);
  assert.equal(result.retrievalBlockReason, 'preserve_service_plan_direct_answer');
});

test('phase835: mixed-domain direct answer fallback keeps retrieval disabled', () => {
  const result = resolveRetrievalDecision({
    messageText: '引っ越しと学校の手続きが同時に不安。まず何から確認すべきか順番だけ教えて。',
    normalizedConversationIntent: 'housing',
    genericFallbackSlice: 'followup',
    followupResolvedFromHistory: false,
    followupIntent: 'next_step'
  }, {
    strategy: 'domain_concierge',
    strategyReason: 'mixed_domain_direct_answer',
    fallbackType: 'mixed_domain_direct_answer'
  });

  assert.equal(result.retrieveNeeded, false);
  assert.equal(result.retrievalBlockedByStrategy, true);
  assert.equal(result.retrievalBlockReason, 'preserve_mixed_domain_direct_answer');
});
