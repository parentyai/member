'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildQualityFrameworkSummary } = require('../../src/routes/admin/osLlmUsageSummary');

test('phase756: quality board includes category improvement/regression and unmet category fields', () => {
  const quality = buildQualityFrameworkSummary({
    conversationQuality: {
      sampleCount: 40,
      legacyTemplateHitRate: 0.02,
      defaultCasualRate: 0.15,
      contradictionRate: 0.06,
      avgSourceAuthorityScore: 0.71,
      avgSourceFreshnessScore: 0.69,
      conciseModeAppliedRate: 0.62,
      repetitionPreventedRate: 0.55,
      directAnswerAppliedRate: 0.58,
      clarifySuppressedRate: 0.5,
      avgContextCarryScore: 0.51,
      avgRepeatRiskScore: 0.48,
      followupQuestionIncludedRate: 0.6,
      domainIntentConciergeRate: 0.57,
      avgUnsupportedClaimCount: 0.09,
      officialOnlySatisfiedRate: 0.67,
      retrieveNeededRate: 0.49,
      verificationOutcomes: [{ verificationOutcome: 'clarify', count: 20 }]
    },
    gateAuditBaseline: { acceptedRate: 0.63 },
    optimization: { compatShareWindow: 0.24 },
    releaseReadiness: { ready: false, metrics: { avgEvidenceCoverage: 0.55 } },
    byPlan: {
      free: { blockedRate: 0.35 },
      pro: { blockedRate: 0.28 }
    },
    actionRows: [],
    baselineOverallScore: 80
  });

  assert.equal(typeof quality.categoryImprovementRate, 'number');
  assert.equal(typeof quality.categoryRegressionRate, 'number');
  assert.equal(Array.isArray(quality.improvedDimensions), true);
  assert.equal(Array.isArray(quality.regressedDimensions), true);
  assert.equal(Array.isArray(quality.unmetCategories), true);
  assert.equal(typeof quality.warningCategoryCount, 'number');
  assert.equal(typeof quality.failCategoryCount, 'number');
});
