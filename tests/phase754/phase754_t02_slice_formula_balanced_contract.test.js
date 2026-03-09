'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildQualityFrameworkSummary } = require('../../src/routes/admin/osLlmUsageSummary');

function bySlice(summary, key) {
  return (Array.isArray(summary.slices) ? summary.slices : []).find((row) => row && row.sliceKey === key) || null;
}

test('phase754: free/admin/compat slices use balanced quality signals and reach pass on stable runtime quality', () => {
  const quality = buildQualityFrameworkSummary({
    conversationQuality: {
      sampleCount: 180,
      legacyTemplateHitRate: 0.01,
      defaultCasualRate: 0.04,
      contradictionRate: 0.02,
      avgSourceAuthorityScore: 0.88,
      avgSourceFreshnessScore: 0.86,
      conciseModeAppliedRate: 0.82,
      repetitionPreventedRate: 0.86,
      directAnswerAppliedRate: 0.8,
      clarifySuppressedRate: 0.78,
      avgContextCarryScore: 0.76,
      avgRepeatRiskScore: 0.24,
      followupQuestionIncludedRate: 0.77,
      domainIntentConciergeRate: 0.8,
      avgUnsupportedClaimCount: 0.02,
      officialOnlySatisfiedRate: 0.89,
      retrieveNeededRate: 0.25,
      verificationOutcomes: [{ verificationOutcome: 'clarify', count: 24 }]
    },
    gateAuditBaseline: {
      acceptedRate: 0.9,
      entryTypes: [
        { entryType: 'webhook', count: 120, allowCount: 95, acceptedRate: 0.7917 },
        { entryType: 'admin', count: 40, allowCount: 36, acceptedRate: 0.9 },
        { entryType: 'compat', count: 20, allowCount: 18, acceptedRate: 0.9 }
      ],
      entryQualitySignals: [
        {
          entryType: 'admin',
          sampleCount: 40,
          legacyTemplateHitRate: 0,
          conciseModeAppliedRate: 1,
          directAnswerAppliedRate: 0.92,
          repetitionPreventedRate: 1,
          clarifySuppressedRate: 0.92,
          defaultCasualRate: 0,
          followupQuestionIncludedRate: 0.1,
          avgContextCarryScore: 0.8,
          avgRepeatRiskScore: 0.1
        },
        {
          entryType: 'compat',
          sampleCount: 20,
          legacyTemplateHitRate: 0.02,
          conciseModeAppliedRate: 0.95,
          directAnswerAppliedRate: 0.9,
          repetitionPreventedRate: 1,
          clarifySuppressedRate: 0.9,
          defaultCasualRate: 0,
          followupQuestionIncludedRate: 0.05,
          avgContextCarryScore: 0.78,
          avgRepeatRiskScore: 0.12
        }
      ]
    },
    optimization: { compatShareWindow: 0.12 },
    releaseReadiness: { ready: true, metrics: { avgEvidenceCoverage: 0.83 } },
    byPlan: {
      free: { blockedRate: 0.14 },
      pro: { blockedRate: 0.08 }
    },
    actionRows: [],
    baselineOverallScore: 90
  });

  assert.equal(bySlice(quality, 'free').status, 'pass');
  assert.equal(bySlice(quality, 'admin').status, 'pass');
  assert.equal(bySlice(quality, 'compat').status, 'pass');
});
