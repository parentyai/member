'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');
const {
  baseFlags,
  buildPlanInfo,
  makeBlockedGroundedReply,
  makeDomainCandidate,
  makeFaqArticle,
  makeSearchFaqDeps
} = require('./_helpers');

test('phase834: housing question prefers knowledge-backed candidate before domain concierge fallback', async () => {
  const article = makeFaqArticle();
  const faqDeps = makeSearchFaqDeps(article);
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'u_phase834_housing',
    messageText: '住まい探しって最初に何を見るべきですか？',
    paidIntent: 'situation_analysis',
    planInfo: buildPlanInfo(),
    llmFlags: baseFlags,
    deps: Object.assign({
      generatePaidCasualReply: () => ({ replyText: 'こんにちは。' }),
      generateGroundedReply: makeBlockedGroundedReply('housing_grounding_missing'),
      generateDomainConciergeCandidate: async () => makeDomainCandidate('housing')
    }, faqDeps)
  });

  assert.equal(result.packet.genericFallbackSlice, 'housing');
  assert.equal(result.telemetry.retrievalBlockedByStrategy, false);
  assert.ok(['saved_faq_candidate', 'housing_knowledge_candidate'].includes(result.telemetry.selectedCandidateKind));
  assert.equal(result.telemetry.knowledgeCandidateUsed, true);
  assert.ok(['prefer_saved_faq_activation', 'prefer_housing_knowledge_activation'].includes(result.telemetry.fallbackPriorityReason));
  assert.notEqual(result.telemetry.selectedCandidateKind, 'domain_concierge_candidate');
});
