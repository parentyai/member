'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildReleaseReadiness } = require('../../src/routes/admin/osLlmUsageSummary');

test('phase723: release readiness returns ready=true when all quality thresholds pass', () => {
  const result = buildReleaseReadiness({
    assistantQuality: {
      sampleCount: 40,
      avgEvidenceCoverage: 0.92,
      fallbackReasons: [
        { fallbackReason: 'none', count: 30 },
        { fallbackReason: 'citation_missing', count: 6 },
        { fallbackReason: 'llm_error', count: 4 }
      ]
    },
    gateAuditBaseline: {
      callsTotal: 40,
      blockedCount: 8,
      acceptedRate: 0.8,
      blockedReasons: [
        { reason: 'citation_missing', count: 4 },
        { reason: 'template_violation', count: 2 },
        { reason: 'snapshot_stale', count: 2 }
      ]
    }
  });

  assert.equal(result.ready, true);
  assert.equal(result.recommendation, 'promote_to_prod');
  assert.equal(result.metrics.citationMissingRate, 0.1);
  assert.equal(result.metrics.templateViolationRate, 0.05);
  assert.equal(result.metrics.fallbackRate, 0.25);
  assert.deepEqual(result.blockedBy, []);
});

test('phase723: release readiness returns hold when citation/template/fallback thresholds fail', () => {
  const result = buildReleaseReadiness({
    assistantQuality: {
      sampleCount: 12,
      avgEvidenceCoverage: 0.6,
      fallbackReasons: [
        { fallbackReason: 'none', count: 4 },
        { fallbackReason: 'citation_missing', count: 5 },
        { fallbackReason: 'llm_error', count: 3 }
      ]
    },
    gateAuditBaseline: {
      callsTotal: 12,
      blockedCount: 7,
      acceptedRate: 0.4167,
      blockedReasons: [
        { reason: 'citation_missing', count: 4 },
        { reason: 'template_violation', count: 2 },
        { reason: 'snapshot_stale', count: 1 }
      ]
    }
  });

  assert.equal(result.ready, false);
  assert.equal(result.recommendation, 'hold_in_stg');
  assert.ok(result.blockedBy.includes('sample_count'));
  assert.ok(result.blockedBy.includes('accepted_rate'));
  assert.ok(result.blockedBy.includes('citation_missing_rate'));
  assert.ok(result.blockedBy.includes('fallback_rate'));
  assert.ok(result.blockedBy.includes('avg_evidence_coverage'));
});

test('phase723: release readiness applies threshold overrides add-only', () => {
  const result = buildReleaseReadiness({
    assistantQuality: {
      sampleCount: 15,
      avgEvidenceCoverage: 0.6,
      fallbackReasons: [{ fallbackReason: 'none', count: 15 }]
    },
    gateAuditBaseline: {
      callsTotal: 15,
      blockedCount: 6,
      acceptedRate: 0.6,
      blockedReasons: [{ reason: 'citation_missing', count: 2 }]
    }
  }, {
    minSampleCount: 10,
    minAcceptedRate: 0.55,
    maxCitationMissingRate: 0.2,
    maxTemplateViolationRate: 0.2,
    maxFallbackRate: 0.4,
    minEvidenceCoverage: 0.55
  });

  assert.equal(result.ready, true);
  assert.equal(result.thresholds.minSampleCount, 10);
  assert.equal(result.thresholds.minEvidenceCoverage, 0.55);
});
