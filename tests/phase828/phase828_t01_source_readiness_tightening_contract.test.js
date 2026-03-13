'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { computeSourceReadiness } = require('../../src/domain/llm/knowledge/computeSourceReadiness');

test('phase828: high-risk required source without refs refuses and records metadata reasons', () => {
  const result = computeSourceReadiness({
    intentRiskTier: 'high',
    retrieveNeeded: true,
    retrievalQuality: 'good',
    evidenceCoverage: 0.88,
    nowMs: Date.parse('2026-03-12T12:00:00.000Z'),
    candidates: [
      {
        sourceType: 'official',
        authorityLevel: 'federal',
        authorityTier: 'T1_OFFICIAL_OPERATION',
        bindingLevel: 'POLICY',
        status: 'active',
        validUntil: '2026-06-01T00:00:00.000Z',
        requiredLevel: 'required',
        linkRegistryCount: 0,
        sourceSnapshotRefCount: 0
      }
    ]
  });

  assert.equal(result.sourceReadinessDecision, 'refuse');
  assert.equal(result.requiredSourceReferenceMissingCount, 1);
  assert.ok(result.reasonCodes.includes('required_source_reference_missing'));
  assert.ok(result.reasonCodes.includes('source_reference_missing'));
});

test('phase828: medium-risk weak metadata clarifies instead of allow', () => {
  const result = computeSourceReadiness({
    intentRiskTier: 'medium',
    retrieveNeeded: true,
    retrievalQuality: 'good',
    evidenceCoverage: 0.84,
    nowMs: Date.parse('2026-03-12T12:00:00.000Z'),
    candidates: [
      {
        sourceType: 'semi_official',
        authorityLevel: 'other',
        authorityTier: '',
        bindingLevel: '',
        status: 'active',
        validUntil: null,
        requiredLevel: 'required',
        linkRegistryCount: 0,
        sourceSnapshotRefCount: 0
      }
    ]
  });

  assert.equal(result.sourceReadinessDecision, 'clarify');
  assert.ok(result.reasonCodes.includes('freshness_metadata_missing'));
  assert.ok(result.reasonCodes.includes('required_source_reference_missing'));
  assert.ok(result.reasonCodes.includes('freshness_below_threshold'));
});
