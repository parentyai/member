'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildQualityFrameworkSummary } = require('../../src/routes/admin/osLlmUsageSummary');

test('phase750: usage summary builds quality framework payload with scorecard/slices/frontier', () => {
  const summary = buildQualityFrameworkSummary({
    conversationQuality: {
      sampleCount: 100,
      legacyTemplateHitRate: 0.01,
      defaultCasualRate: 0.01,
      contradictionRate: 0.01,
      avgSourceAuthorityScore: 0.9,
      avgSourceFreshnessScore: 0.88,
      conciseModeAppliedRate: 0.82,
      repetitionPreventedRate: 0.79,
      followupQuestionIncludedRate: 0.76,
      domainIntentConciergeRate: 0.84,
      avgUnsupportedClaimCount: 0.02,
      officialOnlySatisfiedRate: 0.91,
      retrieveNeededRate: 0.22,
      verificationOutcomes: [{ verificationOutcome: 'clarify', count: 7 }]
    },
    gateAuditBaseline: { acceptedRate: 0.9 },
    optimization: { compatShareWindow: 0.04 },
    releaseReadiness: { ready: true, metrics: { avgEvidenceCoverage: 0.88 } },
    byPlan: {
      free: { blockedRate: 0.2 },
      pro: { blockedRate: 0.08 }
    },
    actionRows: [
      {
        judgeConfidence: 0.87,
        judgeDisagreement: 0.08,
        benchmarkVersion: 'bench-v1.0.0',
        contaminationRisk: 'low',
        replayFailureType: 'none',
        latencyMs: 930,
        costUsd: 0.031
      },
      {
        judgeConfidence: 0.82,
        judgeDisagreement: 0.07,
        benchmarkVersion: 'bench-v1.0.0',
        contaminationRisk: 'medium',
        replayFailureType: 'quote_unsend',
        latencyMs: 1200,
        costUsd: 0.032
      }
    ],
    baselineOverallScore: 54.9
  });

  assert.equal(summary.frameworkVersion, 'v1');
  assert.ok(Array.isArray(summary.dimensions));
  assert.ok(summary.dimensions.length >= 24);
  assert.ok(Array.isArray(summary.slices));
  assert.ok(summary.slices.some((row) => row.sliceKey === 'minority_personas'));
  assert.ok(summary.judgeCalibration && typeof summary.judgeCalibration === 'object');
  assert.ok(summary.benchmark && typeof summary.benchmark === 'object');
  assert.ok(summary.replay && typeof summary.replay === 'object');
  assert.ok(summary.frontier && typeof summary.frontier === 'object');
});
