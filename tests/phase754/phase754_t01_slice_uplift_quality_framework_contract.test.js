'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildQualityFrameworkSummary } = require('../../src/routes/admin/osLlmUsageSummary');

function sliceStatus(summary, key) {
  const rows = Array.isArray(summary && summary.slices) ? summary.slices : [];
  const row = rows.find((item) => item && item.sliceKey === key);
  return row ? row.status : 'missing';
}

test('phase754: quality framework promotes free/admin/compat slices with direct-answer and concise signals', () => {
  const quality = buildQualityFrameworkSummary({
    conversationQuality: {
      sampleCount: 240,
      legacyTemplateHitRate: 0.004,
      defaultCasualRate: 0.01,
      contradictionRate: 0.01,
      avgSourceAuthorityScore: 0.93,
      avgSourceFreshnessScore: 0.91,
      conciseModeAppliedRate: 0.92,
      repetitionPreventedRate: 0.91,
      directAnswerAppliedRate: 0.94,
      clarifySuppressedRate: 0.9,
      avgContextCarryScore: 0.86,
      avgRepeatRiskScore: 0.18,
      followupQuestionIncludedRate: 0.86,
      domainIntentConciergeRate: 0.9,
      avgUnsupportedClaimCount: 0.01,
      officialOnlySatisfiedRate: 0.92,
      retrieveNeededRate: 0.18,
      verificationOutcomes: [{ verificationOutcome: 'clarify', count: 10 }]
    },
    gateAuditBaseline: { acceptedRate: 0.94 },
    optimization: { compatShareWindow: 0.05 },
    releaseReadiness: { ready: true, metrics: { avgEvidenceCoverage: 0.9 } },
    byPlan: {
      free: { blockedRate: 0.07 },
      pro: { blockedRate: 0.04 }
    },
    actionRows: [],
    baselineOverallScore: 90
  });

  assert.equal(sliceStatus(quality, 'free'), 'pass');
  assert.equal(sliceStatus(quality, 'admin'), 'pass');
  assert.equal(sliceStatus(quality, 'compat'), 'pass');
  assert.equal(typeof quality.categoryImprovementRate, 'number');
  assert.equal(Array.isArray(quality.unmetCategories), true);
});
