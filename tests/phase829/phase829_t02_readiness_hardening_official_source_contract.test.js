'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateAnswerReadiness } = require('../../src/domain/llm/quality/evaluateAnswerReadiness');

test('phase829: medium-risk weak official-only signal clarifies instead of allowing', () => {
  const result = evaluateAnswerReadiness({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'medium',
    sourceAuthorityScore: 0.84,
    sourceFreshnessScore: 0.84,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: false,
    officialOnlySatisfiedObserved: true,
    evidenceCoverage: 0.86,
    evidenceCoverageObserved: true
  });

  assert.equal(result.decision, 'clarify');
  assert.ok(result.reasonCodes.includes('medium_risk_official_not_ready'));
  assert.equal(result.decisionSource, 'medium_risk_official_guard');
});
