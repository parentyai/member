'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateAnswerReadiness } = require('../../src/domain/llm/quality/evaluateAnswerReadiness');

test('phase829: journey misalignment is reflected as clarify for non-low-risk routes', () => {
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
    journeyContext: true,
    journeyAlignedAction: false
  });

  assert.equal(result.decision, 'clarify');
  assert.ok(result.reasonCodes.includes('journey_alignment_not_ready'));
  assert.equal(result.decisionSource, 'journey_alignment_guard');
});
