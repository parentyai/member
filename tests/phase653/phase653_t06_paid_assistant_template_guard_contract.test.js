'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { guardLlmOutput } = require('../../src/usecases/llm/guardLlmOutput');

function loadGeneratePaidAssistantReplyWithStubbedFaq(faqResult) {
  const faqPath = require.resolve('../../src/usecases/faq/searchFaqFromKb');
  const targetPath = require.resolve('../../src/usecases/assistant/generatePaidAssistantReply');
  const originalFaq = require.cache[faqPath];
  const originalTarget = require.cache[targetPath];

  require.cache[faqPath] = {
    id: faqPath,
    filename: faqPath,
    loaded: true,
    exports: {
      searchFaqFromKb: async () => faqResult
    }
  };
  delete require.cache[targetPath];
  const loaded = require('../../src/usecases/assistant/generatePaidAssistantReply');

  function restore() {
    if (originalFaq) require.cache[faqPath] = originalFaq;
    else delete require.cache[faqPath];
    if (originalTarget) require.cache[targetPath] = originalTarget;
    else delete require.cache[targetPath];
  }

  return {
    generatePaidAssistantReply: loaded.generatePaidAssistantReply,
    restore
  };
}

test('phase653: paid assistant returns fixed 5-section template with citation-bound next actions', async (t) => {
  const { generatePaidAssistantReply, restore } = loadGeneratePaidAssistantReplyWithStubbedFaq({
    ok: true,
    candidates: [
      { articleId: 'kb_insurance', title: '保険', body: '保険加入の説明' },
      { articleId: 'kb_school', title: '学校', body: '学校手続きの説明' }
    ]
  });
  t.after(() => restore());

  const response = await generatePaidAssistantReply({
    question: '赴任時の抜け漏れを確認したい',
    intent: 'next_action',
    locale: 'ja',
    llmPolicy: { model: 'gpt-4o-mini', max_output_tokens: 600 },
    llmAdapter: {
      answerFaq: async () => ({
        answer: {
          schemaId: 'PaidAssistantReply.v1',
          generatedAt: new Date().toISOString(),
          advisoryOnly: true,
          intent: 'next_action_generation',
          situation: '家族帯同で保険と学校手続きが優先です。',
          gaps: ['保険証書の提出漏れ'],
          risks: ['学校申請の遅延'],
          nextActions: [{ action: '保険証書を提出', evidenceKey: 'kb_insurance' }],
          evidenceKeys: ['kb_insurance', 'kb_school']
        },
        usage: { prompt_tokens: 50, completion_tokens: 80 }
      })
    }
  });

  assert.equal(response.ok, true);
  assert.equal(response.intent, 'next_action_generation');
  assert.ok(response.replyText.includes('1) 要約（前提）'));
  assert.ok(response.replyText.includes('2) 抜け漏れ（最大5）'));
  assert.ok(response.replyText.includes('3) リスク（最大3）'));
  assert.ok(response.replyText.includes('4) NextAction（最大3・根拠キー付）'));
  assert.ok(response.replyText.includes('5) 参照（KB/CityPackキー）'));
  assert.ok(response.replyText.includes('根拠:kb_insurance'));
  assert.equal(response.tokensIn, 50);
  assert.equal(response.tokensOut, 80);
});

test('phase653: paid assistant blocks when citations are missing', async (t) => {
  const { generatePaidAssistantReply, restore } = loadGeneratePaidAssistantReplyWithStubbedFaq({
    ok: true,
    candidates: []
  });
  t.after(() => restore());

  const response = await generatePaidAssistantReply({
    question: '状況整理して',
    intent: 'situation_analysis',
    locale: 'ja',
    llmAdapter: {
      answerFaq: async () => ({ answer: {} })
    }
  });

  assert.equal(response.ok, false);
  assert.equal(response.blockedReason, 'citation_missing');
});

test('phase653: guard blocks section over-limit and missing next action citation', async () => {
  const guard = await guardLlmOutput({
    purpose: 'paid_assistant',
    schemaId: 'PaidAssistantReply.v1',
    output: {
      schemaId: 'PaidAssistantReply.v1',
      generatedAt: new Date().toISOString(),
      advisoryOnly: true,
      intent: 'gap_check',
      situation: 'summary',
      gaps: ['a', 'b', 'c', 'd', 'e', 'f'],
      risks: ['r1'],
      nextActions: ['保険を確認する'],
      evidenceKeys: ['kb_1']
    },
    allowedEvidenceKeys: ['kb_1']
  });

  assert.equal(guard.ok, false);
  assert.equal(guard.blockedReason, 'template_violation');
});
