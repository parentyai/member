'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getFaqAnswer } = require('../../src/usecases/phaseLLM4/getFaqAnswer');

function makeRepo(states) {
  return {
    getLink: async (id) => {
      if (!Object.prototype.hasOwnProperty.call(states, id)) return null;
      return { id, lastHealth: { state: states[id] } };
    }
  };
}

function stubDeps(overrides) {
  return Object.assign({
    appendAuditLog: async () => ({ id: 'audit-1' })
  }, overrides || {});
}

test('phaseLLM4: fallback when LLM disabled', async () => {
  const result = await getFaqAnswer(
    { question: 'Q1', sourceIds: ['s1'] },
    stubDeps({
      env: {},
      linkRegistryRepo: makeRepo({ s1: 'OK' })
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.llmStatus, 'disabled');
  assert.equal(result.llmUsed, false);
  assert.equal(result.faqAnswer.schemaId, 'FAQAnswer.v1');
  assert.equal(result.faqAnswer.citations.length, 1);
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
    { question: 'Q2', sourceIds: ['s1'] },
    stubDeps({
      env: { LLM_FEATURE_FLAG: 'true' },
      llmAdapter: { answerFaq: async () => payload },
      linkRegistryRepo: makeRepo({ s1: 'OK' })
    })
  );
  assert.equal(result.llmUsed, true);
  assert.equal(result.llmStatus, 'ok');
  assert.deepEqual(result.faqAnswer, payload);
});

test('phaseLLM4: invalid citation source triggers fallback', async () => {
  const payload = {
    schemaId: 'FAQAnswer.v1',
    generatedAt: new Date().toISOString(),
    advisoryOnly: true,
    question: 'Q3',
    answer: 'A3',
    citations: [{ sourceType: 'link_registry', sourceId: 'unknown' }]
  };
  const result = await getFaqAnswer(
    { question: 'Q3', sourceIds: ['s1'] },
    stubDeps({
      env: { LLM_FEATURE_FLAG: 'true' },
      llmAdapter: { answerFaq: async () => payload },
      linkRegistryRepo: makeRepo({ s1: 'OK' })
    })
  );
  assert.equal(result.llmUsed, false);
  assert.equal(result.llmStatus, 'invalid_citation_source');
  assert.ok(Array.isArray(result.faqAnswer.citations));
});

test('phaseLLM4: WARN link is blocked', async () => {
  const result = await getFaqAnswer(
    { question: 'Q4', sourceIds: ['s1'] },
    stubDeps({
      env: {},
      linkRegistryRepo: makeRepo({ s1: 'WARN' })
    })
  );
  assert.equal(result.llmUsed, false);
  assert.equal(result.llmStatus, 'disabled');
  assert.ok(Array.isArray(result.blockedSourceIds));
  assert.equal(result.blockedSourceIds[0], 's1');
});
