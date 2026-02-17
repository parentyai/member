'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getFaqAnswer } = require('../../src/usecases/phaseLLM4/getFaqAnswer');

function makeLinkRepo(states) {
  return {
    getLink: async (id) => {
      if (!Object.prototype.hasOwnProperty.call(states, id)) return null;
      return { id, lastHealth: { state: states[id] } };
    }
  };
}

function makeFaqArticlesRepo(rows) {
  return {
    searchActiveArticles: async () => rows
  };
}

function stubDeps(overrides) {
  return Object.assign({
    appendAuditLog: async () => ({ id: 'audit-1' }),
    faqAnswerLogsRepo: { appendFaqAnswerLog: async () => ({ id: 'faq-log-1' }) },
    getLlmEnabled: async () => false,
    env: {}
  }, overrides || {});
}

test('phaseLLM4: block when LLM disabled', async () => {
  const result = await getFaqAnswer(
    { question: 'Q1', locale: 'ja' },
    stubDeps({
      faqArticlesRepo: makeFaqArticlesRepo([
        { id: 'a1', title: 'T', body: 'B', tags: ['tag'], riskLevel: 'low', linkRegistryIds: ['s1'] }
      ]),
      linkRegistryRepo: makeLinkRepo({ s1: 'OK' })
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.blockedReason, 'llm_disabled');
  assert.equal(result.httpStatus, 422);
  assert.equal(result.llmUsed, false);
});

test('phaseLLM4: accepts valid LLM answer with allowed citations', async () => {
  const payload = {
    schemaId: 'FAQAnswer.v1',
    generatedAt: new Date().toISOString(),
    advisoryOnly: true,
    question: 'Q2',
    answer: 'A2',
    citations: [{ sourceType: 'link_registry', sourceId: 's1' }]
  };
  const result = await getFaqAnswer(
    { question: 'Q2', locale: 'ja' },
    stubDeps({
      env: { LLM_FEATURE_FLAG: 'true' },
      getLlmEnabled: async () => true,
      llmAdapter: { answerFaq: async () => payload },
      faqArticlesRepo: makeFaqArticlesRepo([
        { id: 'a1', title: 'T', body: 'B', tags: ['tag'], riskLevel: 'low', linkRegistryIds: ['s1'] }
      ]),
      linkRegistryRepo: makeLinkRepo({ s1: 'OK' })
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.llmUsed, true);
  assert.equal(result.llmStatus, 'ok');
  assert.deepEqual(result.faqAnswer, payload);
});

test('phaseLLM4: citations required (0 citations => block)', async () => {
  const payload = {
    schemaId: 'FAQAnswer.v1',
    generatedAt: new Date().toISOString(),
    advisoryOnly: true,
    question: 'Q3',
    answer: 'A3',
    citations: []
  };
  const result = await getFaqAnswer(
    { question: 'Q3', locale: 'ja' },
    stubDeps({
      env: { LLM_FEATURE_FLAG: 'true' },
      getLlmEnabled: async () => true,
      llmAdapter: { answerFaq: async () => payload },
      faqArticlesRepo: makeFaqArticlesRepo([
        { id: 'a1', title: 'T', body: 'B', tags: ['tag'], riskLevel: 'low', linkRegistryIds: ['s1'] }
      ]),
      linkRegistryRepo: makeLinkRepo({ s1: 'OK' })
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.blockedReason, 'citations_required');
  assert.equal(result.httpStatus, 422);
});

test('phaseLLM4: WARN link is blocked', async () => {
  const payload = {
    schemaId: 'FAQAnswer.v1',
    generatedAt: new Date().toISOString(),
    advisoryOnly: true,
    question: 'Q4',
    answer: 'A4',
    citations: [{ sourceType: 'link_registry', sourceId: 's1' }]
  };
  const result = await getFaqAnswer(
    { question: 'Q4', locale: 'ja' },
    stubDeps({
      env: { LLM_FEATURE_FLAG: 'true' },
      getLlmEnabled: async () => true,
      llmAdapter: { answerFaq: async () => payload },
      faqArticlesRepo: makeFaqArticlesRepo([
        { id: 'a1', title: 'T', body: 'B', tags: ['tag'], riskLevel: 'low', linkRegistryIds: ['s1'] }
      ]),
      linkRegistryRepo: makeLinkRepo({ s1: 'WARN' })
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.blockedReason, 'warn_link_blocked');
  assert.equal(result.httpStatus, 422);
});
