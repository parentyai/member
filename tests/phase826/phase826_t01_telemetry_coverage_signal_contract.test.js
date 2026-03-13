'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildQualityLoopV2Summary } = require('../../src/routes/admin/osLlmUsageSummary');

function actionRow(overrides) {
  return Object.assign({
    createdAt: '2026-03-12T10:00:00.000Z',
    answerReadinessVersion: 'v2',
    answerReadinessV2Stage: 'soft_enforcement',
    answerReadinessV2Mode: 'soft_enforced_v2',
    intentRiskTier: 'high',
    officialOnlySatisfied: true,
    officialOnlySatisfiedObserved: true,
    evidenceCoverage: 0.92,
    evidenceCoverageObserved: true,
    cityPackGrounded: true,
    cityPackGroundedObserved: true,
    cityPackFreshnessScore: 0.93,
    cityPackAuthorityScore: 0.95,
    staleSourceBlocked: false,
    staleSourceBlockedObserved: true,
    emergencyOfficialSourceSatisfied: true,
    emergencyOfficialSourceSatisfiedObserved: true,
    journeyAlignedAction: true,
    journeyAlignedActionObserved: true,
    savedFaqReused: true,
    savedFaqReusePass: true,
    savedFaqReusePassObserved: true
  }, overrides || {});
}

test('phase826: summary restores integration telemetry coverage signals as observed metrics', () => {
  const summary = buildQualityLoopV2Summary({
    actionRows: [
      actionRow(),
      actionRow({
        intentRiskTier: 'medium',
        officialOnlySatisfied: false,
        officialOnlySatisfiedObserved: true,
        evidenceCoverage: 0.72,
        cityPackGrounded: false,
        staleSourceBlocked: true,
        emergencyOfficialSourceSatisfied: false,
        journeyAlignedAction: false,
        savedFaqReusePass: false
      })
    ],
    faqRows: [
      {
        createdAt: '2026-03-12T10:05:00.000Z',
        savedFaqReused: true,
        savedFaqReusePass: true,
        savedFaqReusePassObserved: true,
        sourceAuthorityScore: 0.9,
        sourceFreshnessScore: 0.91,
        evidenceCoverage: 0.88,
        evidenceCoverageObserved: true
      }
    ],
    traceSearchAuditRows: [],
    traceProbeRows: [],
    conversationQuality: { sampleCount: 3 },
    optimization: { compatShareWindow: 0.04 }
  });

  assert.equal(summary.integrationKpis.cityPackGroundingRate.sampleCount, 2);
  assert.equal(summary.integrationKpis.staleSourceBlockRate.sampleCount, 2);
  assert.equal(summary.integrationKpis.emergencyOfficialSourceRate.sampleCount, 2);
  assert.equal(summary.integrationKpis.journeyAlignedActionRate.sampleCount, 2);
  assert.equal(summary.integrationKpis.savedFaqReusePassRate.sampleCount, 3);
  assert.equal(summary.integrationKpis.evidenceCoverage.sampleCount, 3);
  assert.equal(summary.integrationKpis.officialSourceUsageRate.sampleCount, 1);
});
