'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { computeSourceReadiness } = require('../../src/domain/llm/knowledge/computeSourceReadiness');

test('phase804: required blocked source refuses and records required_source_blocked', () => {
  const result = computeSourceReadiness({
    intentRiskTier: 'high',
    retrieveNeeded: true,
    retrievalQuality: 'good',
    evidenceCoverage: 0.9,
    nowMs: Date.parse('2026-03-12T12:00:00.000Z'),
    candidates: [
      {
        sourceType: 'official',
        authorityLevel: 'federal',
        status: 'blocked',
        validUntil: '2026-06-01T00:00:00.000Z',
        requiredLevel: 'required'
      }
    ]
  });

  assert.equal(result.sourceReadinessDecision, 'refuse');
  assert.equal(result.requiredBlockedCount, 1);
  assert.ok(result.reasonCodes.includes('required_source_blocked'));
});

test('phase804: optional stale source hedges and records optional_source_stale', () => {
  const result = computeSourceReadiness({
    intentRiskTier: 'low',
    retrieveNeeded: true,
    retrievalQuality: 'good',
    evidenceCoverage: 0.92,
    nowMs: Date.parse('2026-03-12T12:00:00.000Z'),
    candidates: [
      {
        sourceType: 'official',
        authorityLevel: 'state',
        status: 'active',
        validUntil: '2026-03-01T00:00:00.000Z',
        requiredLevel: 'optional'
      },
      {
        sourceType: 'official',
        authorityLevel: 'state',
        status: 'active',
        validUntil: '2026-07-01T00:00:00.000Z',
        requiredLevel: 'optional'
      }
    ]
  });

  assert.equal(result.sourceReadinessDecision, 'hedged');
  assert.equal(result.optionalBlockedCount, 1);
  assert.ok(result.reasonCodes.includes('optional_source_stale'));
});

test('phase804: high-risk non-official required source refuses with official-only failure', () => {
  const result = computeSourceReadiness({
    intentRiskTier: 'high',
    retrieveNeeded: true,
    retrievalQuality: 'good',
    evidenceCoverage: 0.94,
    nowMs: Date.parse('2026-03-12T12:00:00.000Z'),
    candidates: [
      {
        sourceType: 'community',
        authorityLevel: 'other',
        status: 'active',
        validUntil: '2026-06-01T00:00:00.000Z',
        requiredLevel: 'required'
      }
    ]
  });

  assert.equal(result.officialOnlySatisfied, false);
  assert.equal(result.sourceReadinessDecision, 'refuse');
  assert.ok(result.reasonCodes.includes('official_only_not_satisfied'));
});
