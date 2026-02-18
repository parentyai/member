'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

function buildArticle(index, score) {
  return {
    id: `faq-${index}`,
    title: `FAQ ${index}`,
    body: `本文 ${index}`,
    tags: ['faq'],
    riskLevel: 'low',
    linkRegistryIds: index === 0 ? ['https://example.com/direct'] : [`lk_${index}`],
    status: 'active',
    validUntil: new Date('2026-12-31T00:00:00Z'),
    allowedIntents: ['FAQ'],
    disclaimerVersion: 'faq_disclaimer_v1',
    version: '1.0.0',
    versionSemver: '1.0.0',
    searchScore: score
  };
}

test('phase246: blocked payload always includes safe fallbackActions and suggestedFaqs <= 3', async () => {
  const result = await answerFaqFromKb(
    {
      question: '保険の手続き',
      traceId: 'TRACE_PHASE246_BLOCK'
    },
    {
      env: { LLM_FEATURE_FLAG: 'true' },
      getLlmEnabled: async () => true,
      getLlmPolicy: async () => ({ lawfulBasis: 'contract', consentVerified: true, crossBorder: true }),
      faqArticlesRepo: {
        searchActiveArticles: async () => [
          buildArticle(0, 1.1),
          buildArticle(1, 1.0),
          buildArticle(2, 0.9),
          buildArticle(3, 0.8)
        ]
      },
      appendAuditLog: async () => ({ id: 'audit-246' })
    }
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blocked, true);
  assert.ok(Array.isArray(result.suggestedFaqs));
  assert.ok(result.suggestedFaqs.length <= 3);
  assert.ok(Array.isArray(result.fallbackActions));
  assert.ok(result.fallbackActions.every((item) => typeof item.sourceId === 'string' && !/^https?:\/\//i.test(item.sourceId)));
});

test('phase246: admin app filters direct URL sourceId in block panel', () => {
  const jsPath = path.resolve(__dirname, '../../apps/admin/assets/admin_app.js');
  const source = fs.readFileSync(jsPath, 'utf8');
  assert.match(source, /looksLikeDirectUrl\(item\.sourceId\)/);
});
