'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationQualitySummary } = require('../../src/routes/admin/osLlmUsageSummary');

test('phase832: summary keeps generic fallback slices and knowledge usage explainable', () => {
  const summary = buildConversationQualitySummary([
    {
      createdAt: '2026-03-13T10:00:00.000Z',
      lineUserId: 'u1',
      conversationMode: 'concierge',
      strategy: 'clarify',
      strategyReason: 'broad_question_clarify',
      fallbackTemplateKind: 'generic_fallback',
      finalizerTemplateKind: 'generic_fallback',
      genericFallbackSlice: 'broad',
      knowledgeCandidateCountBySource: { faq: 0, savedFaq: 0, cityPack: 0, sourceRefs: 0, webSearch: 0 },
      knowledgeCandidateUsed: false
    },
    {
      createdAt: '2026-03-13T10:01:00.000Z',
      lineUserId: 'u2',
      conversationMode: 'concierge',
      strategy: 'domain_concierge',
      strategyReason: 'explicit_domain_intent',
      fallbackTemplateKind: 'domain_concierge_template',
      finalizerTemplateKind: 'domain_concierge_template',
      genericFallbackSlice: 'housing',
      knowledgeCandidateCountBySource: { faq: 1, savedFaq: 1, cityPack: 1, sourceRefs: 2, webSearch: 0 },
      knowledgeCandidateUsed: true,
      cityPackUsedInAnswer: true,
      savedFaqUsedInAnswer: true
    }
  ]);

  const slices = Object.fromEntries(summary.genericFallbackSlices.map((row) => [row.genericFallbackSlice, row.count]));
  const bySlice = Object.fromEntries(summary.genericFallbackRepeatRateBySlice.map((row) => [row.genericFallbackSlice, row.sampleCount]));

  assert.equal(slices.broad, 1);
  assert.equal(slices.housing, 1);
  assert.equal(bySlice.broad, 1);
  assert.equal(bySlice.housing, 1);
  assert.equal(summary.knowledgeCandidateUsedRate, 0.5);
  assert.equal(summary.cityPackUsedInAnswerRate, 1);
  assert.equal(summary.savedFaqUsedInAnswerRate, 1);
  assert.deepEqual(summary.knowledgeCandidateCountBySourceTotals, {
    faq: 1,
    savedFaq: 1,
    cityPack: 1,
    sourceRefs: 2,
    webSearch: 0
  });
});
