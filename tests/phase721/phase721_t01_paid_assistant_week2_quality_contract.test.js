'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

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
    classifyPaidIntent: loaded.classifyPaidIntent,
    generatePaidAssistantReply: loaded.generatePaidAssistantReply,
    restore
  };
}

test('phase721: intent classifier resolves "what to do first" phrase to next_action_generation', async (t) => {
  const loaded = loadGeneratePaidAssistantReplyWithStubbedFaq({
    ok: true,
    candidates: [{ articleId: 'kb_task', title: '手続き', body: 'body', searchScore: 0.9 }]
  });
  t.after(() => loaded.restore());

  const intent = loaded.classifyPaidIntent('何から手順を進めればいい？');
  assert.equal(intent, 'next_action_generation');
});

test('phase721: nextActions canonicalizes citation format and removes duplicate actions', async (t) => {
  const loaded = loadGeneratePaidAssistantReplyWithStubbedFaq({
    ok: true,
    candidates: [{ articleId: 'kb_housing', title: '住居', body: '住居手続き', searchScore: 0.91 }]
  });
  t.after(() => loaded.restore());

  const response = await loaded.generatePaidAssistantReply({
    question: '住居手続きの進め方を教えて',
    intent: 'next_action_generation',
    locale: 'ja',
    llmPolicy: { model: 'gpt-4o-mini', max_output_tokens: 600 },
    llmAdapter: {
      answerFaq: async () => ({
        answer: {
          schemaId: 'PaidAssistantReply.v1',
          generatedAt: new Date().toISOString(),
          advisoryOnly: true,
          intent: 'next_action_generation',
          situation: '住居手続きの期限管理が必要です。',
          gaps: [],
          risks: [],
          nextActions: [
            '住居契約の期限を確認してください (根拠:kb_housing)',
            '住居契約の期限を確認する 根拠:kb_housing',
            '住居契約の期限を確認する'
          ]
        },
        usage: { prompt_tokens: 10, completion_tokens: 30 }
      })
    }
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.output.evidenceKeys, ['kb_housing']);
  assert.equal(response.output.nextActions.length, 1);
  assert.equal(response.output.nextActions[0], '住居契約の期限を確認する (根拠:kb_housing)');
  assert.ok(response.replyText.includes('住居契約の期限を確認する (根拠:kb_housing)'));
  assert.ok(!response.replyText.includes('確認してください'));
});

test('phase721: generic next action is normalized to concrete phrasing with citation', async (t) => {
  const loaded = loadGeneratePaidAssistantReplyWithStubbedFaq({
    ok: true,
    candidates: [{ articleId: 'kb_generic', title: '一般', body: '一般手続き', searchScore: 0.82 }]
  });
  t.after(() => loaded.restore());

  const response = await loaded.generatePaidAssistantReply({
    question: 'まずやることを教えて',
    intent: 'next_action_generation',
    locale: 'ja',
    llmPolicy: { model: 'gpt-4o-mini', max_output_tokens: 600 },
    llmAdapter: {
      answerFaq: async () => ({
        answer: {
          schemaId: 'PaidAssistantReply.v1',
          generatedAt: new Date().toISOString(),
          advisoryOnly: true,
          intent: 'next_action_generation',
          situation: '優先順位の確認が必要です。',
          gaps: [],
          risks: [],
          nextActions: ['確認してください'],
          evidenceKeys: ['kb_generic']
        },
        usage: { prompt_tokens: 8, completion_tokens: 20 }
      })
    }
  });

  assert.equal(response.ok, true);
  assert.equal(response.output.nextActions[0], '対象手続きを確認する (根拠:kb_generic)');
});
