'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveSharedAnswerReadiness } = require('../../src/domain/llm/quality/resolveSharedAnswerReadiness');

test('phase827: compat high-risk entries clarify when official and evidence signals are missing', () => {
  const result = resolveSharedAnswerReadiness({
    entryType: 'compat',
    domainIntent: 'ssn',
    llmUsed: true,
    replyText: '回答'
  });

  assert.equal(result.intentRiskTier, 'high');
  assert.equal(result.readiness.decision, 'clarify');
  assert.ok(result.readiness.reasonCodes.includes('compat_high_risk_policy_tightened'));
  assert.equal(result.readinessTelemetryV2.compatContextActive, true);
  assert.equal(result.readinessTelemetryV2.officialOnlySatisfiedObserved, false);
  assert.equal(result.readinessTelemetryV2.evidenceCoverageObserved, false);
});

test('phase827: compat high-risk entries can still allow when explicit high-quality signals are present', () => {
  const result = resolveSharedAnswerReadiness({
    entryType: 'compat',
    domainIntent: 'ssn',
    llmUsed: true,
    replyText: '回答',
    lawfulBasis: 'contract',
    consentVerified: true,
    legalDecision: 'allow',
    sourceAuthorityScore: 0.95,
    sourceFreshnessScore: 0.95,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    officialOnlySatisfiedObserved: true,
    evidenceCoverage: 0.92,
    evidenceCoverageObserved: true
  });

  assert.equal(result.readiness.decision, 'allow');
  assert.ok(!result.readiness.reasonCodes.includes('compat_high_risk_policy_tightened'));
});
