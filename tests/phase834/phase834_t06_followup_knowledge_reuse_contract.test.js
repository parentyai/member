'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');
const {
  baseFlags,
  buildPlanInfo,
  makeBlockedGroundedReply,
  makeFaqArticle
} = require('./_helpers');

test('phase834: follow-up reuses prior domain context when building knowledge candidates', async () => {
  const article = makeFaqArticle({
    title: '住まい探しの時期',
    body: '住まい探しは、内見の前に希望条件と入居時期を固めると進めやすいです。'
  });
  let observedQuery = null;
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'u_phase834_followup',
    messageText: 'それってどのタイミングでやるのがいいですか？',
    paidIntent: 'situation_analysis',
    recentActionRows: [{
      createdAt: new Date().toISOString(),
      domainIntent: 'housing',
      followupIntent: 'next_step',
      replyText: '住まい探しでは、候補条件を3つまで絞ると進めやすいです。',
      committedFollowupQuestion: '希望エリアは決まっていますか？'
    }],
    planInfo: buildPlanInfo(),
    llmFlags: baseFlags,
    deps: {
      generatePaidCasualReply: () => ({ replyText: 'こんにちは。' }),
      generateGroundedReply: makeBlockedGroundedReply('followup_grounding_missing'),
      searchFaqFromKb: async ({ question }) => {
        observedQuery = question;
        return { ok: true, candidates: [{ articleId: article.id }] };
      },
      getFaqArticle: async () => article
    }
  });

  assert.equal(result.packet.genericFallbackSlice, 'followup');
  assert.equal(result.telemetry.priorContextUsed, true);
  assert.equal(result.telemetry.retrievalBlockedByStrategy, false);
  assert.equal(result.telemetry.knowledgeCandidateUsed, true);
  assert.ok(['knowledge_backed_candidate', 'saved_faq_candidate'].includes(result.telemetry.selectedCandidateKind));
  assert.match(observedQuery || '', /住まい探し/);
});
