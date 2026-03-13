'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateAnswerReadiness } = require('../../src/domain/llm/quality/evaluateAnswerReadiness');

test('phase827: high-risk missing evidence coverage clarifies instead of allowing', () => {
  const result = evaluateAnswerReadiness({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'high',
    sourceAuthorityScore: 0.92,
    sourceFreshnessScore: 0.93,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    officialOnlySatisfiedObserved: true
  });

  assert.equal(result.decision, 'clarify');
  assert.ok(result.reasonCodes.includes('evidence_coverage_signal_missing'));
  assert.equal(result.qualitySnapshot.evidenceCoverageObserved, false);
});

test('phase827: high-risk weak evidence no longer allows with otherwise strong sources', () => {
  const result = evaluateAnswerReadiness({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'high',
    sourceAuthorityScore: 0.92,
    sourceFreshnessScore: 0.93,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    officialOnlySatisfiedObserved: true,
    evidenceCoverage: 0.75,
    evidenceCoverageObserved: true
  });

  assert.equal(result.decision, 'hedged');
  assert.ok(result.reasonCodes.includes('readiness_hedged'));
});

test('phase827: low-risk flow keeps prior allow behavior with the same evidence score', () => {
  const result = evaluateAnswerReadiness({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'low',
    sourceAuthorityScore: 0.92,
    sourceFreshnessScore: 0.93,
    sourceReadinessDecision: 'allow',
    evidenceCoverage: 0.75,
    evidenceCoverageObserved: true
  });

  assert.equal(result.decision, 'allow');
  assert.ok(result.reasonCodes.includes('readiness_allow'));
});
