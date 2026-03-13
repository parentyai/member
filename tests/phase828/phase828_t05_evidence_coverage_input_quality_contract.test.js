'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildKnowledgeReadinessCandidates } = require('../../src/usecases/faq/buildKnowledgeReadinessCandidates');
const { computeSourceReadiness } = require('../../src/domain/llm/knowledge/computeSourceReadiness');

test('phase828: knowledge candidate builder improves evidence-quality inputs with refs and record metadata', () => {
  const readinessCandidates = buildKnowledgeReadinessCandidates([
    {
      riskLevel: 'medium',
      status: 'active',
      validUntil: '2026-08-01T00:00:00.000Z',
      linkRegistryIds: ['link-1', 'link-2'],
      sourceSnapshotRefs: ['snapshot-1'],
      recordEnvelope: {
        authority_tier: 'T2_PUBLIC_DATA',
        binding_level: 'REFERENCE'
      }
    }
  ]);

  const result = computeSourceReadiness({
    intentRiskTier: 'medium',
    retrieveNeeded: true,
    retrievalQuality: 'good',
    evidenceCoverage: 0.86,
    nowMs: Date.parse('2026-03-12T12:00:00.000Z'),
    candidates: readinessCandidates
  });

  assert.equal(result.sampleSize, 1);
  assert.ok(result.metadataCompletenessScore >= 0.8);
  assert.equal(result.sourceReferenceMissingCount, 0);
  assert.ok(result.sourceAuthorityScore >= 0.6);
});
