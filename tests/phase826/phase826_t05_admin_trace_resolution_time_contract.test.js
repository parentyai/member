'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildQualityLoopV2Summary } = require('../../src/routes/admin/osLlmUsageSummary');

test('phase826: summary exposes adminTraceResolutionTimeMs as observed duration KPI', () => {
  const summary = buildQualityLoopV2Summary({
    actionRows: [],
    faqRows: [],
    traceSearchAuditRows: [],
    traceProbeRows: [{
      traceId: 'trace-ops-1',
      createdAt: '2026-03-12T10:01:00.000Z',
      traceJoinCompleteness: 0.97,
      adminTraceResolutionTimeMs: 600000,
      traceBundleLoadMs: 120,
      joinedDomains: ['llm_action_logs', 'faq_answer_logs'],
      missingDomains: [],
      joinedDomainCount: 2,
      missingDomainCount: 0,
      provenance: 'trace_bundle_probe'
    }],
    conversationQuality: { sampleCount: 1 },
    optimization: { compatShareWindow: 0.04 }
  });

  assert.equal(summary.integrationKpis.adminTraceResolutionTime.sampleCount, 1);
  assert.equal(summary.integrationKpis.adminTraceResolutionTimeMs.sampleCount, 1);
  assert.equal(summary.integrationKpis.adminTraceResolutionTimeMs.valueMs, 600000);
  assert.equal(summary.integrationKpis.adminTraceResolutionTimeMs.status, 'pass');
});
