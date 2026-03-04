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

test('phase720: intent classifier v2 resolves timeline phrase without explicit legacy keyword', async (t) => {
  const loaded = loadGeneratePaidAssistantReplyWithStubbedFaq({
    ok: true,
    candidates: [{ articleId: 'kb_timeline', title: 'timeline', body: 'body', searchScore: 0.9 }]
  });
  t.after(() => loaded.restore());

  const intent = loaded.classifyPaidIntent('赴任準備の日程を順番に組みたい');
  assert.equal(intent, 'timeline_build');
});

test('phase720: paid assistant supplements missing evidence keys from KB candidates', async (t) => {
  const loaded = loadGeneratePaidAssistantReplyWithStubbedFaq({
    ok: true,
    candidates: [{ articleId: 'kb_housing', title: '住居', body: '住居手続き', searchScore: 0.88 }]
  });
  t.after(() => loaded.restore());

  const response = await loaded.generatePaidAssistantReply({
    question: '住居手続きで次にやることを教えて',
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
          situation: '住居関連の優先順位を確認します。',
          gaps: [],
          risks: [],
          nextActions: ['住居契約の期限を確認する']
        },
        usage: { prompt_tokens: 12, completion_tokens: 34 }
      })
    }
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.citations, ['kb_housing']);
  assert.ok(response.replyText.includes('根拠:kb_housing'));
  assert.ok(response.assistantQuality);
  assert.equal(response.assistantQuality.intentResolved, 'next_action_generation');
  assert.equal(response.assistantQuality.kbTopScore, 0.88);
  assert.equal(response.assistantQuality.evidenceCoverage, 1);
});

test('phase720: paid assistant exposes blocked-stage quality metadata on KB miss', async (t) => {
  const loaded = loadGeneratePaidAssistantReplyWithStubbedFaq({
    ok: true,
    candidates: []
  });
  t.after(() => loaded.restore());

  const response = await loaded.generatePaidAssistantReply({
    question: '状況を整理して',
    intent: 'situation_analysis',
    locale: 'ja',
    llmAdapter: {
      answerFaq: async () => ({ answer: {} })
    }
  });

  assert.equal(response.ok, false);
  assert.equal(response.blockedReason, 'citation_missing');
  assert.ok(response.assistantQuality);
  assert.equal(response.assistantQuality.blockedStage, 'kb_retrieval');
  assert.equal(response.assistantQuality.fallbackReason, 'citation_missing');
});
