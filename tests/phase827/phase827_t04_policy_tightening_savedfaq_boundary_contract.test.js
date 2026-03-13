'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { refineSavedFaqReuseSignals } = require('../../src/usecases/faq/refineSavedFaqReuseSignals');

test('phase827: high-risk saved FAQ reuse now blocks clarify-level source readiness', () => {
  const result = refineSavedFaqReuseSignals({
    intentRiskTier: 'high',
    savedFaqSignals: {
      savedFaqReused: true,
      savedFaqReusePass: true,
      savedFaqReuseReasonCodes: ['saved_faq_reuse_ready'],
      sourceSnapshotRefs: ['snapshot-1']
    },
    sourceReadiness: {
      officialOnlySatisfied: true,
      sourceReadinessDecision: 'clarify',
      sourceAuthorityScore: 0.9,
      sourceFreshnessScore: 0.9
    }
  });

  assert.equal(result.savedFaqReusePass, false);
  assert.ok(result.savedFaqReuseReasonCodes.includes('saved_faq_source_readiness_blocked'));
});

test('phase827: high-risk saved FAQ reuse requires source snapshots and strong authority/freshness', () => {
  const result = refineSavedFaqReuseSignals({
    intentRiskTier: 'high',
    savedFaqSignals: {
      savedFaqReused: true,
      savedFaqReusePass: true,
      savedFaqReuseReasonCodes: ['saved_faq_reuse_ready'],
      sourceSnapshotRefs: []
    },
    sourceReadiness: {
      officialOnlySatisfied: true,
      sourceReadinessDecision: 'allow',
      sourceAuthorityScore: 0.6,
      sourceFreshnessScore: 0.6
    }
  });

  assert.equal(result.savedFaqReusePass, false);
  assert.ok(result.savedFaqReuseReasonCodes.includes('saved_faq_source_snapshot_missing'));
  assert.ok(result.savedFaqReuseReasonCodes.includes('saved_faq_authority_below_threshold'));
  assert.ok(result.savedFaqReuseReasonCodes.includes('saved_faq_freshness_below_threshold'));
});
