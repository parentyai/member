'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildQualityLoopV2Summary } = require('../../src/routes/admin/osLlmUsageSummary');

test('phase826: evidence coverage and official source usage distinguish observed false from missing rows', () => {
  const summary = buildQualityLoopV2Summary({
    actionRows: [
      {
        createdAt: '2026-03-12T10:00:00.000Z',
        intentRiskTier: 'high',
        officialOnlySatisfied: false,
        officialOnlySatisfiedObserved: true,
        evidenceCoverage: 0.4,
        evidenceCoverageObserved: true
      },
      {
        createdAt: '2026-03-12T10:01:00.000Z',
        intentRiskTier: 'high'
      }
    ],
    faqRows: [],
    traceSearchAuditRows: [],
    traceProbeRows: [],
    conversationQuality: { sampleCount: 2 },
    optimization: { compatShareWindow: 0.04 }
  });

  assert.equal(summary.integrationKpis.evidenceCoverage.sampleCount, 1);
  assert.equal(summary.integrationKpis.evidenceCoverage.missingCount, 1);
  assert.equal(summary.integrationKpis.evidenceCoverage.status, 'fail');
  assert.equal(summary.integrationKpis.officialSourceUsageRate.sampleCount, 1);
  assert.equal(summary.integrationKpis.officialSourceUsageRate.missingCount, 1);
  assert.equal(summary.integrationKpis.officialSourceUsageRate.status, 'fail');
});
