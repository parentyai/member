'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  OPS_EXPLANATION_SCHEMA_ID,
  NEXT_ACTION_CANDIDATES_SCHEMA_ID,
  FAQ_ANSWER_SCHEMA_ID
} = require('../../src/llm/schemas');
const { validateSchema } = require('../../src/llm/validateSchema');

const now = new Date('2026-02-16T00:00:00Z').toISOString();

test('phaseLLM1: validate OpsExplanation schema', () => {
  const payload = {
    schemaId: OPS_EXPLANATION_SCHEMA_ID,
    generatedAt: now,
    advisoryOnly: true,
    facts: [
      { id: 'f1', label: 'readiness', value: 'READY', sourceType: 'ops_state' }
    ],
    interpretations: [],
    candidates: [
      { action: 'MONITOR', reason: 'stable', confidence: 0.5 }
    ],
    safety: { status: 'OK', reasons: [] }
  };
  const result = validateSchema(OPS_EXPLANATION_SCHEMA_ID, payload);
  assert.strictEqual(result.ok, true);
});

test('phaseLLM1: validate NextActionCandidates schema', () => {
  const payload = {
    schemaId: NEXT_ACTION_CANDIDATES_SCHEMA_ID,
    generatedAt: now,
    advisoryOnly: true,
    candidates: [
      {
        action: 'REVIEW',
        reason: 'needs review',
        confidence: 0.7,
        safety: { status: 'OK', reasons: [] }
      }
    ]
  };
  const result = validateSchema(NEXT_ACTION_CANDIDATES_SCHEMA_ID, payload);
  assert.strictEqual(result.ok, true);
});

test('phaseLLM1: validate FAQAnswer schema', () => {
  const payload = {
    schemaId: FAQ_ANSWER_SCHEMA_ID,
    generatedAt: now,
    advisoryOnly: true,
    question: 'How do I change my address?',
    answer: 'Use the address change checklist in the admin UI.',
    citations: [
      { sourceType: 'link_registry', sourceId: 'faq-address-change' }
    ],
    safety: { status: 'OK', reasons: [] }
  };
  const result = validateSchema(FAQ_ANSWER_SCHEMA_ID, payload);
  assert.strictEqual(result.ok, true);
});

test('phaseLLM1: schema rejects direct URL in FAQ answer', () => {
  const payload = {
    schemaId: FAQ_ANSWER_SCHEMA_ID,
    generatedAt: now,
    advisoryOnly: true,
    question: 'Where is the FAQ?',
    answer: 'See https://example.com/faq',
    citations: [
      { sourceType: 'link_registry', sourceId: 'faq-main' }
    ]
  };
  const result = validateSchema(FAQ_ANSWER_SCHEMA_ID, payload);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.includes('direct_url_detected'));
});
