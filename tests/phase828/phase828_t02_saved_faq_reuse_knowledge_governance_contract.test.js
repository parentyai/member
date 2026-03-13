'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { refineSavedFaqReuseSignals } = require('../../src/usecases/faq/refineSavedFaqReuseSignals');

test('phase828: medium-risk saved FAQ reuse fails when source snapshots are missing', () => {
  const result = refineSavedFaqReuseSignals({
    intentRiskTier: 'medium',
    savedFaqSignals: {
      savedFaqReused: true,
      savedFaqReusePass: true,
      savedFaqReuseReasonCodes: ['saved_faq_reuse_ready'],
      sourceSnapshotRefs: []
    },
    sourceReadiness: {
      officialOnlySatisfied: true,
      sourceReadinessDecision: 'allow',
      sourceAuthorityScore: 0.81,
      sourceFreshnessScore: 0.83
    }
  });

  assert.equal(result.savedFaqReusePass, false);
  assert.ok(result.savedFaqReuseReasonCodes.includes('saved_faq_source_snapshot_missing'));
});

test('phase828: medium-risk saved FAQ reuse fails when authority and freshness fall below thresholds', () => {
  const result = refineSavedFaqReuseSignals({
    intentRiskTier: 'medium',
    savedFaqSignals: {
      savedFaqReused: true,
      savedFaqReusePass: true,
      savedFaqReuseReasonCodes: ['saved_faq_reuse_ready'],
      sourceSnapshotRefs: ['snapshot-1']
    },
    sourceReadiness: {
      officialOnlySatisfied: true,
      sourceReadinessDecision: 'allow',
      sourceAuthorityScore: 0.51,
      sourceFreshnessScore: 0.59
    }
  });

  assert.equal(result.savedFaqReusePass, false);
  assert.ok(result.savedFaqReuseReasonCodes.includes('saved_faq_authority_below_threshold'));
  assert.ok(result.savedFaqReuseReasonCodes.includes('saved_faq_freshness_below_threshold'));
});
