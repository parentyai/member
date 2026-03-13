'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateAnswerReadiness } = require('../../src/domain/llm/quality/evaluateAnswerReadiness');

test('phase829: high-risk weak evidence now clarifies instead of staying hedged', () => {
  const result = evaluateAnswerReadiness({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'high',
    sourceAuthorityScore: 0.95,
    sourceFreshnessScore: 0.95,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    officialOnlySatisfiedObserved: true,
    evidenceCoverage: 0.75,
    evidenceCoverageObserved: true
  });

  assert.equal(result.decision, 'clarify');
  assert.ok(result.reasonCodes.includes('high_risk_evidence_not_ready'));
  assert.equal(result.decisionSource, 'high_risk_evidence_guard');
  assert.equal(result.qualitySnapshot.readinessHardeningVersion, 'r829');
});
