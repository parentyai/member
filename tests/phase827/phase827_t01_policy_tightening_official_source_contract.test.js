'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateAnswerReadiness } = require('../../src/domain/llm/quality/evaluateAnswerReadiness');

test('phase827: high-risk missing official source signal clarifies instead of allowing', () => {
  const result = evaluateAnswerReadiness({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'high',
    sourceAuthorityScore: 0.94,
    sourceFreshnessScore: 0.94,
    sourceReadinessDecision: 'allow',
    evidenceCoverage: 0.92,
    evidenceCoverageObserved: true
  });

  assert.equal(result.decision, 'clarify');
  assert.ok(result.reasonCodes.includes('official_only_signal_missing'));
  assert.equal(result.qualitySnapshot.officialOnlySatisfiedObserved, false);
  assert.equal(result.qualitySnapshot.policyTighteningVersion, 'r827');
});

test('phase827: high-risk explicit official source miss still refuses', () => {
  const result = evaluateAnswerReadiness({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'high',
    sourceAuthorityScore: 0.9,
    sourceFreshnessScore: 0.9,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: false,
    officialOnlySatisfiedObserved: true,
    evidenceCoverage: 0.9,
    evidenceCoverageObserved: true
  });

  assert.equal(result.decision, 'refuse');
  assert.ok(result.reasonCodes.includes('official_only_not_satisfied'));
  assert.equal(result.qualitySnapshot.officialOnlySatisfiedObserved, true);
});
