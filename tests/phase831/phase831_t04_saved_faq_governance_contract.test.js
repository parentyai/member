'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildQualityLoopV2Summary } = require('../../src/routes/admin/osLlmUsageSummary');

test('phase831: saved FAQ integration KPI is observed from live rows', () => {
  const summary = buildQualityLoopV2Summary({
    actionRows: [
      {
        createdAt: '2026-03-12T10:00:00.000Z',
        savedFaqReusePass: true,
        savedFaqReusePassObserved: true
      }
    ],
    faqRows: [
      {
        createdAt: '2026-03-12T10:01:00.000Z',
        savedFaqReusePass: false,
        savedFaqReusePassObserved: true
      }
    ],
    traceSearchAuditRows: [],
    traceProbeRows: [],
    conversationQuality: { sampleCount: 2 },
    optimization: { compatShareWindow: 0.04 }
  });

  assert.equal(summary.integrationKpis.savedFaqReusePassRate.sampleCount, 2);
  assert.equal(summary.integrationKpis.savedFaqReusePassRate.missingCount, 0);
  assert.equal(summary.integrationKpis.savedFaqReusePassRate.value, 0.5);
  assert.equal(summary.criticalSlices.find((row) => row.sliceKey === 'saved_faq_high_risk_reuse').sourceMetric, 'savedFaqReusePassRate');
});
