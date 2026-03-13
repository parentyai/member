'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildQualityLoopV2Summary } = require('../../src/routes/admin/osLlmUsageSummary');

test('phase826: summary preserves false vs missing distinction for restored booleans', () => {
  const summary = buildQualityLoopV2Summary({
    actionRows: [
      {
        createdAt: '2026-03-12T10:00:00.000Z',
        cityPackGrounded: false,
        cityPackGroundedObserved: true,
        cityPackFreshnessScore: 0.91,
        cityPackAuthorityScore: 0.9,
        savedFaqReused: true,
        savedFaqReusePass: false,
        savedFaqReusePassObserved: true
      },
      {
        createdAt: '2026-03-12T10:01:00.000Z',
        cityPackFreshnessScore: 0,
        cityPackAuthorityScore: 0
      }
    ],
    faqRows: [],
    traceSearchAuditRows: [],
    traceProbeRows: [],
    conversationQuality: { sampleCount: 2 },
    optimization: { compatShareWindow: 0.04 }
  });

  assert.equal(summary.integrationKpis.cityPackGroundingRate.sampleCount, 1);
  assert.equal(summary.integrationKpis.cityPackGroundingRate.missingCount, 0);
  assert.equal(summary.integrationKpis.cityPackGroundingRate.value, 0);
  assert.equal(summary.integrationKpis.savedFaqReusePassRate.sampleCount, 1);
  assert.equal(summary.integrationKpis.savedFaqReusePassRate.value, 0);
});
