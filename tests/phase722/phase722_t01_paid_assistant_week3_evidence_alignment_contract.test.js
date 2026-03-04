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
    generatePaidAssistantReply: loaded.generatePaidAssistantReply,
    restore
  };
}

test('phase722: paid assistant selects diversified KB candidates for prompt context', async (t) => {
  const loaded = loadGeneratePaidAssistantReplyWithStubbedFaq({
    ok: true,
    candidates: [
      { articleId: 'kb_housing_dup_1', title: '住居契約 手続き', body: '住居契約の期限確認', searchScore: 0.99 },
      { articleId: 'kb_housing_dup_2', title: '住居契約 手続き', body: '住居契約の期限確認を再確認', searchScore: 0.98 },
      { articleId: 'kb_housing_dup_3', title: '住居契約 手続き', body: '住居契約で必要な提出物', searchScore: 0.97 },
      { articleId: 'kb_tax', title: '税務申告', body: '税務申告の期限', searchScore: 0.965 },
      { articleId: 'kb_school', title: '学校手続き', body: '入学手続きの必要書類', searchScore: 0.96 },
      { articleId: 'kb_visa', title: 'ビザ更新', body: '申請の必要書類', searchScore: 0.955 },
      { articleId: 'kb_medical', title: '医療手続き', body: '保険加入の提出物', searchScore: 0.95 },
      { articleId: 'kb_move', title: '引越し準備', body: '引越し前後の手続き一覧', searchScore: 0.94 }
    ]
  });
  t.after(() => loaded.restore());

  let promptKbIds = [];
  const response = await loaded.generatePaidAssistantReply({
    question: '赴任前に何を優先すべきか教えて',
    intent: 'next_action_generation',
    locale: 'ja',
    llmPolicy: { model: 'gpt-4o-mini', max_output_tokens: 600 },
    llmAdapter: {
      answerFaq: async (requestPayload) => {
        promptKbIds = (requestPayload && requestPayload.input && Array.isArray(requestPayload.input.kbCandidates))
          ? requestPayload.input.kbCandidates.map((item) => item.articleId)
          : [];
        const topEvidence = promptKbIds[0] || 'kb_housing_dup_1';
        return {
          answer: {
            schemaId: 'PaidAssistantReply.v1',
            generatedAt: new Date().toISOString(),
            advisoryOnly: true,
            intent: 'next_action_generation',
            situation: '優先順位を整理します。',
            gaps: [],
            risks: [],
            nextActions: [`最初の手続きを確認する (根拠:${topEvidence})`],
            evidenceKeys: [topEvidence]
          },
          usage: { prompt_tokens: 10, completion_tokens: 20 }
        };
      }
    }
  });

  assert.equal(response.ok, true);
  assert.equal(promptKbIds.length, 5);
  const duplicateHousingCount = promptKbIds.filter((id) => id.startsWith('kb_housing_dup_')).length;
  assert.ok(duplicateHousingCount <= 2, 'diversified selection should suppress duplicate housing variants');
  assert.ok(promptKbIds.includes('kb_tax'));
  assert.ok(promptKbIds.includes('kb_school'));
  assert.ok(promptKbIds.includes('kb_visa') || promptKbIds.includes('kb_medical'));
});

test('phase722: hallucinated evidence keys are filtered and normalized to allowed KB keys', async (t) => {
  const loaded = loadGeneratePaidAssistantReplyWithStubbedFaq({
    ok: true,
    candidates: [{ articleId: 'kb_visa', title: 'ビザ更新', body: 'ビザ更新手順', searchScore: 0.91 }]
  });
  t.after(() => loaded.restore());

  const response = await loaded.generatePaidAssistantReply({
    question: 'ビザ更新で何をすればいい？',
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
          situation: '更新手順を確認します。',
          gaps: [],
          risks: [],
          nextActions: ['必要書類を確認する (根拠:fake_key)'],
          evidenceKeys: ['kb_visa', 'fake_key']
        },
        usage: { prompt_tokens: 9, completion_tokens: 21 }
      })
    }
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.output.evidenceKeys, ['kb_visa']);
  assert.equal(response.output.nextActions[0], '必要書類を確認する (根拠:kb_visa)');
  assert.equal(response.assistantQuality.evidenceCoverage, 1);
});

test('phase722: evidence keys are canonicalized case-insensitively for object nextActions', async (t) => {
  const loaded = loadGeneratePaidAssistantReplyWithStubbedFaq({
    ok: true,
    candidates: [{ articleId: 'kb_school', title: '学校手続き', body: '学校の申請順', searchScore: 0.87 }]
  });
  t.after(() => loaded.restore());

  const response = await loaded.generatePaidAssistantReply({
    question: '学校申請の手順を知りたい',
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
          situation: '学校申請を優先します。',
          gaps: [],
          risks: [],
          nextActions: [{ action: '学校申請の期限を確認する', evidenceKey: 'KB_SCHOOL' }],
          evidenceKeys: ['KB_SCHOOL']
        },
        usage: { prompt_tokens: 7, completion_tokens: 18 }
      })
    }
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.output.evidenceKeys, ['kb_school']);
  assert.equal(response.output.nextActions[0], '学校申請の期限を確認する (根拠:kb_school)');
});

test('phase722: direct URL in paid nextActions remains blocked by guard', async (t) => {
  const loaded = loadGeneratePaidAssistantReplyWithStubbedFaq({
    ok: true,
    candidates: [{ articleId: 'kb_safe', title: '安全情報', body: '公式手順', searchScore: 0.9 }]
  });
  t.after(() => loaded.restore());

  const response = await loaded.generatePaidAssistantReply({
    question: '手順を教えて',
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
          situation: '公式手順を確認します。',
          gaps: [],
          risks: [],
          nextActions: ['公式ページを確認する https://evil.example (根拠:kb_safe)'],
          evidenceKeys: ['kb_safe']
        },
        usage: { prompt_tokens: 6, completion_tokens: 15 }
      })
    }
  });

  assert.equal(response.ok, false);
  assert.ok(
    ['direct_url_forbidden', 'template_violation'].includes(response.blockedReason),
    `unexpected blockedReason: ${response.blockedReason}`
  );
});
