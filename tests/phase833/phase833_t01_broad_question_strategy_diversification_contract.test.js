'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationPacket } = require('../../src/domain/llm/orchestrator/buildConversationPacket');
const { buildStrategyPlan } = require('../../src/domain/llm/orchestrator/strategyPlanner');
const { resolveRetrievalDecision } = require('../../src/domain/llm/orchestrator/retrievalController');

test('phase833: broad question prefers grounding probe before clarify', () => {
  const packet = buildConversationPacket({
    lineUserId: 'u_phase833_broad',
    messageText: 'アメリカ赴任の準備って何から始めればいいですか？',
    planInfo: { plan: 'pro', status: 'active' },
    paidIntent: 'situation_analysis',
    llmFlags: { llmConciergeEnabled: true }
  });

  const plan = buildStrategyPlan(packet);
  const retrieval = resolveRetrievalDecision(packet, plan);

  assert.equal(packet.genericFallbackSlice, 'broad');
  assert.equal(plan.strategy, 'grounded_answer');
  assert.equal(plan.strategyReason, 'broad_question_grounding_probe');
  assert.deepEqual(plan.candidateSet, [
    'structured_answer_candidate',
    'grounded_candidate',
    'domain_concierge_candidate',
    'clarify_candidate'
  ]);
  assert.ok(plan.strategyAlternativeSet.includes('structured_answer'));
  assert.equal(retrieval.retrieveNeeded, true);
  assert.match(retrieval.retrievalPermitReason || '', /broad_structured_grounding_probe/);
});
