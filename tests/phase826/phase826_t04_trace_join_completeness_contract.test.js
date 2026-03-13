'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildTraceSearchAuditRows, buildQualityLoopV2Summary } = require('../../src/routes/admin/osLlmUsageSummary');

test('phase826: trace join completeness can be restored from probe rows even when trace_search payload was sparse', () => {
  const traceSearchRows = buildTraceSearchAuditRows([
    {
      createdAt: '2026-03-12T10:00:00.000Z',
      payloadSummary: { traceId: 'trace-restore-1' }
    }
  ]);

  const summary = buildQualityLoopV2Summary({
    actionRows: [],
    faqRows: [],
    traceSearchAuditRows: traceSearchRows,
    traceProbeRows: [{
      traceId: 'trace-restore-1',
      createdAt: '2026-03-12T10:01:00.000Z',
      traceJoinCompleteness: 0.96,
      adminTraceResolutionTimeMs: 300000,
      traceBundleLoadMs: 100,
      joinedDomains: ['llm_action_logs'],
      missingDomains: [],
      joinedDomainCount: 1,
      missingDomainCount: 0,
      provenance: 'trace_bundle_probe'
    }],
    conversationQuality: { sampleCount: 1 },
    optimization: { compatShareWindow: 0.04 }
  });

  assert.equal(summary.integrationKpis.traceJoinCompleteness.sampleCount, 1);
  assert.equal(summary.integrationKpis.traceJoinCompleteness.missingCount, 0);
  assert.equal(summary.integrationKpis.traceJoinCompleteness.status, 'pass');
});
