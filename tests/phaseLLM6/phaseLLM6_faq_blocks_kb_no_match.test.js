'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

function deps(overrides) {
  return Object.assign({
    appendAuditLog: async () => ({ id: 'audit-1' }),
    faqAnswerLogsRepo: { appendFaqAnswerLog: async () => ({ id: 'faq-log-1' }) },
    getLlmEnabled: async () => true,
    env: { LLM_FEATURE_FLAG: 'true' },
    faqArticlesRepo: { searchActiveArticles: async () => [] }
  }, overrides || {});
}

test('phaseLLM6: faq blocks when KB has no candidate', async () => {
  const result = await answerFaqFromKb({ question: '会員番号は？', locale: 'ja' }, deps());
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.httpStatus, 422);
  assert.strictEqual(result.blockedReason, 'kb_no_match');
});
