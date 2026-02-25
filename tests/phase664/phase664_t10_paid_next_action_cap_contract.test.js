'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const FAQ_MODULE_PATH = require.resolve('../../src/usecases/faq/searchFaqFromKb');
const ASSISTANT_MODULE_PATH = require.resolve('../../src/usecases/assistant/generatePaidAssistantReply');

test('phase664: paid assistant applies maxNextActionsCap as min(policy cap, plan unlock cap)', async () => {
  const faqModule = require(FAQ_MODULE_PATH);
  const originalSearch = faqModule.searchFaqFromKb;
  faqModule.searchFaqFromKb = async () => ({
    replyText: 'fallback',
    citations: ['faq_664_1'],
    candidates: [
      {
        articleId: 'faq_664_1',
        title: 'FAQ 664',
        body: 'contract test body',
        searchScore: 0.9
      }
    ]
  });
  delete require.cache[ASSISTANT_MODULE_PATH];
  const { generatePaidAssistantReply } = require(ASSISTANT_MODULE_PATH);

  try {
    const result = await generatePaidAssistantReply({
      question: '次にやることを教えて',
      intent: 'next_action_generation',
      locale: 'ja',
      llmAdapter: {
        async answerFaq() {
          return {
            answer: {
              intent: 'next_action_generation',
              situation: '状況',
              gaps: ['不足A'],
              risks: ['リスクA'],
              nextActions: ['最初に住所確認', '次に口座開設', '最後に保険確認'],
              evidenceKeys: ['faq_664_1']
            },
            usage: {
              prompt_tokens: 11,
              completion_tokens: 22
            },
            model: 'test-model'
          };
        }
      },
      llmPolicy: {
        output_constraints: {
          max_next_actions: 3,
          max_gaps: 5,
          max_risks: 3,
          require_evidence: true,
          forbid_direct_url: true
        }
      },
      maxNextActionsCap: 1
    });

    assert.equal(result.ok, true);
    assert.equal(Array.isArray(result.output.nextActions), true);
    assert.equal(result.output.nextActions.length, 1);
    assert.match(result.replyText, /最大1/);
  } finally {
    faqModule.searchFaqFromKb = originalSearch;
    delete require.cache[ASSISTANT_MODULE_PATH];
  }
});
