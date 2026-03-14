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

test('phase834: broad question activates runtime knowledge before clarify fallback', async () => {
  const article = makeFaqArticle({
    title: '赴任準備の初手チェック',
    body: '赴任準備では、期限が近い手続きから順に棚卸しすると進めやすいです。'
  });
  const faqDeps = makeSearchFaqDeps(article);
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'u_phase834_broad',
    messageText: 'アメリカ赴任の準備って何から始めればいいですか？',
    paidIntent: 'situation_analysis',
    planInfo: buildPlanInfo(),
    llmFlags: baseFlags,
    deps: Object.assign({
      generatePaidCasualReply: () => ({ replyText: 'こんにちは。' }),
      generateGroundedReply: makeBlockedGroundedReply('broad_grounding_missing'),
      generateDomainConciergeCandidate: async () => makeDomainCandidate('general')
    }, faqDeps)
  });

  assert.equal(result.packet.genericFallbackSlice, 'broad');
  assert.equal(result.telemetry.retrievalBlockedByStrategy, false);
  assert.equal(result.telemetry.knowledgeCandidateUsed, true);
  assert.ok(['knowledge_backed_candidate', 'saved_faq_candidate'].includes(result.telemetry.selectedCandidateKind));
  assert.notEqual(result.telemetry.selectedCandidateKind, 'clarify_candidate');
});
