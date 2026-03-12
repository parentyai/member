'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildQualityLoopV2Summary,
  buildTraceSearchAuditRows
} = require('../../src/routes/admin/osLlmUsageSummary');

test('phase814: quality loop v2 consumes trace_search audit rows for trace join completeness', () => {
  const traceSearchAuditRows = buildTraceSearchAuditRows([
    {
      createdAt: '2026-03-12T16:00:00.000Z',
      payloadSummary: {
        traceJoinCompleteness: 1,
        joinedDomains: ['audits', 'llmActions', 'cityPack', 'emergency', 'journey'],
        missingDomains: [],
        joinedDomainCount: 5,
        missingDomainCount: 0,
        traceBundleLoadMs: 84
      }
    }
  ]);

  const summary = buildQualityLoopV2Summary({
    actionRows: [
      {
        answerReadinessVersion: 'v2',
        readinessDecisionV2: 'allow',
        cityPackGrounded: true,
        cityPackFreshnessScore: 0.94,
        cityPackAuthorityScore: 0.95,
        emergencyContextActive: true,
        emergencyOfficialSourceSatisfied: true,
        taskBlockerDetected: true,
        journeyAlignedAction: true,
        journeyPhase: 'phase_a',
        savedFaqReused: true,
        savedFaqReusePass: true,
        officialOnlySatisfied: true,
        intentRiskTier: 'high',
        crossSystemConflictDetected: false
      }
    ],
    traceSearchAuditRows,
    conversationQuality: { sampleCount: 1 },
    optimization: { compatShareWindow: 0.02 }
  });

  assert.equal(summary.integrationKpis.traceJoinCompleteness.status, 'pass');
  assert.equal(summary.integrationKpis.traceJoinCompleteness.value, 1);
  assert.equal(summary.integrationKpis.traceJoinCompleteness.sampleCount, 1);
  assert.ok(summary.criticalSlices.some((row) => row.sliceKey === 'trace_join_incomplete' && row.status === 'pass'));
});
