'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { computeSourceReadiness } = require('../../src/domain/llm/knowledge/computeSourceReadiness');

test('phase828: low-authority and weak binding sources record reject reasons', () => {
  const result = computeSourceReadiness({
    intentRiskTier: 'medium',
    retrieveNeeded: true,
    retrievalQuality: 'good',
    evidenceCoverage: 0.92,
    nowMs: Date.parse('2026-03-12T12:00:00.000Z'),
    candidates: [
      {
        sourceType: 'other',
        authorityLevel: 'other',
        authorityTier: 'T4_COMMUNITY',
        bindingLevel: 'REFERENCE',
        status: 'active',
        validUntil: null,
        requiredLevel: 'optional',
        linkRegistryCount: 0,
        sourceSnapshotRefCount: 0
      }
    ]
  });

  assert.ok(result.reasonCodes.includes('authority_tier_weak'));
  assert.ok(result.reasonCodes.includes('binding_level_weak'));
  assert.ok(result.reasonCodes.includes('freshness_metadata_missing'));
  assert.ok(result.reasonCodes.includes('authority_below_threshold'));
});
