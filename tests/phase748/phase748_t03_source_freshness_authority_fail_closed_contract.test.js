'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { computeSourceReadiness } = require('../../src/domain/llm/knowledge/computeSourceReadiness');

function candidate(overrides = {}) {
  return {
    sourceType: 'official',
    authorityLevel: 'federal',
    status: 'active',
    validUntil: '2030-01-01T00:00:00.000Z',
    ...overrides
  };
}

test('phase748: source readiness refuses high-risk answers when official-only is not satisfied', () => {
  const result = computeSourceReadiness({
    intentRiskTier: 'high',
    retrieveNeeded: true,
    retrievalQuality: 'good',
    evidenceCoverage: 0.9,
    nowMs: Date.parse('2026-03-01T00:00:00.000Z'),
    candidates: [
      candidate({
        sourceType: 'community',
        authorityLevel: 'other',
        requiredLevel: 'required',
        validUntil: '2026-10-01T00:00:00.000Z'
      })
    ]
  });

  assert.equal(result.sourceReadinessDecision, 'refuse');
  assert.equal(result.officialOnlySatisfied, false);
  assert.ok(result.reasonCodes.includes('official_only_not_satisfied'));
});

test('phase748: source readiness clarifies medium-risk answers when sources are stale/weak', () => {
  const result = computeSourceReadiness({
    intentRiskTier: 'medium',
    retrieveNeeded: true,
    retrievalQuality: 'mixed',
    evidenceCoverage: 0.5,
    nowMs: Date.parse('2026-03-01T00:00:00.000Z'),
    candidates: [
      candidate({
        sourceType: 'other',
        authorityLevel: 'other',
        validUntil: '2026-02-20T00:00:00.000Z'
      })
    ]
  });

  assert.equal(result.sourceReadinessDecision, 'clarify');
  assert.ok(result.reasonCodes.includes('stale_source_detected'));
  assert.ok(result.reasonCodes.includes('freshness_below_threshold'));
});

test('phase748: source readiness allows low-risk answer with strong official and fresh evidence', () => {
  const result = computeSourceReadiness({
    intentRiskTier: 'low',
    retrieveNeeded: true,
    retrievalQuality: 'good',
    evidenceCoverage: 0.92,
    nowMs: Date.parse('2026-03-01T00:00:00.000Z'),
    candidates: [
      candidate({ validUntil: '2026-11-01T00:00:00.000Z' }),
      candidate({
        sourceType: 'semi_official',
        authorityLevel: 'state',
        validUntil: '2026-10-01T00:00:00.000Z'
      })
    ]
  });

  assert.equal(result.sourceReadinessDecision, 'allow');
  assert.equal(result.officialOnlySatisfied, true);
  assert.ok(result.sourceAuthorityScore >= 0.7);
  assert.ok(result.sourceFreshnessScore >= 0.7);
});
