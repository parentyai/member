'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { buildKnowledgeReadinessCandidates } = require('../../src/usecases/faq/buildKnowledgeReadinessCandidates');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase828: knowledge readiness candidates prefer official metadata from record envelope', () => {
  const candidates = buildKnowledgeReadinessCandidates([
    {
      riskLevel: 'high',
      status: 'active',
      validUntil: '2026-06-01T00:00:00.000Z',
      linkRegistryIds: ['link-1'],
      sourceSnapshotRefs: ['snapshot-1'],
      recordEnvelope: {
        authority_tier: 'T1_OFFICIAL_OPERATION',
        binding_level: 'POLICY'
      }
    }
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].sourceType, 'official');
  assert.equal(candidates[0].authorityTier, 'T1_OFFICIAL_OPERATION');
  assert.equal(candidates[0].bindingLevel, 'POLICY');
  assert.equal(candidates[0].requiredLevel, 'required');
  assert.equal(candidates[0].linkRegistryCount, 1);
  assert.equal(candidates[0].sourceSnapshotRefCount, 1);
});

test('phase828: FAQ answer path uses knowledge readiness candidates helper', () => {
  const faqUsecase = read(path.join(process.cwd(), 'src/usecases/faq/answerFaqFromKb.js'));

  assert.ok(faqUsecase.includes("const { buildKnowledgeReadinessCandidates } = require('./buildKnowledgeReadinessCandidates');"));
  assert.ok(faqUsecase.includes('candidates: buildKnowledgeReadinessCandidates(candidates),'));
});
