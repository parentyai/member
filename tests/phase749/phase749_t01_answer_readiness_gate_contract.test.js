'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateAnswerReadiness } = require('../../src/domain/llm/quality/evaluateAnswerReadiness');

test('phase749: readiness refuses when legal consent basis is blocked', () => {
  const result = evaluateAnswerReadiness({
    lawfulBasis: 'consent',
    consentVerified: false,
    crossBorder: false,
    legalDecision: 'blocked',
    intentRiskTier: 'medium',
    sourceAuthorityScore: 0.9,
    sourceFreshnessScore: 0.9,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    evidenceCoverage: 0.9
  });

  assert.equal(result.decision, 'refuse');
  assert.ok(result.reasonCodes.includes('legal_blocked'));
  assert.equal(result.safeResponseMode, 'refuse');
});

test('phase749: readiness refuses high-risk answers when official-only is not satisfied', () => {
  const result = evaluateAnswerReadiness({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'high',
    sourceAuthorityScore: 0.8,
    sourceFreshnessScore: 0.8,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: false,
    evidenceCoverage: 0.8
  });

  assert.equal(result.decision, 'refuse');
  assert.ok(result.reasonCodes.includes('official_only_not_satisfied'));
});

test('phase749: readiness returns hedged on contradiction with strong evidence', () => {
  const result = evaluateAnswerReadiness({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'low',
    sourceAuthorityScore: 0.8,
    sourceFreshnessScore: 0.8,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    contradictionDetected: true,
    evidenceCoverage: 0.9
  });

  assert.equal(result.decision, 'hedged');
  assert.ok(result.reasonCodes.includes('contradiction_detected_hedged'));
  assert.equal(result.safeResponseMode, 'answer_with_hedge');
});

test('phase749: readiness clarifies when support is weak', () => {
  const result = evaluateAnswerReadiness({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'medium',
    sourceAuthorityScore: 0.2,
    sourceFreshnessScore: 0.2,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    evidenceCoverage: 0.1
  });

  assert.equal(result.decision, 'clarify');
  assert.ok(result.reasonCodes.includes('readiness_clarify'));
  assert.equal(result.safeResponseMode, 'clarify');
});
