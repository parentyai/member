'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateAnswerReadiness } = require('../../src/domain/llm/quality/evaluateAnswerReadiness');

test('phase829: medium-risk saved FAQ reuse failure clarifies instead of allowing', () => {
  const result = evaluateAnswerReadiness({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'medium',
    sourceAuthorityScore: 0.84,
    sourceFreshnessScore: 0.84,
    sourceReadinessDecision: 'allow',
    evidenceCoverage: 0.86,
    evidenceCoverageObserved: true,
    savedFaqReused: true,
    savedFaqReusePass: false
  });

  assert.equal(result.decision, 'clarify');
  assert.ok(result.reasonCodes.includes('saved_faq_reuse_not_ready'));
  assert.equal(result.decisionSource, 'saved_faq_reuse_guard');
});
