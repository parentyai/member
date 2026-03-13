'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildTraceJoinSummary } = require('../../src/usecases/admin/getTraceBundle');
const {
  buildTraceSearchAuditRows,
  buildQualityLoopV2Summary,
  mergeTraceAuditRows
} = require('../../src/routes/admin/osLlmUsageSummary');

test('phase831: cross-system trace join keeps integration metrics observable', () => {
  const joinSummary = buildTraceJoinSummary({
    audits: [{ action: 'llm_gate.decision' }, { action: 'faq_answered' }, { action: 'emergency.notice' }, { action: 'city_pack.refresh' }, { action: 'journey_blocked' }],
    decisions: [{ traceId: 'trace-int-1' }],
    timeline: [{ traceId: 'trace-int-1' }],
    llmActions: [{
      traceId: 'trace-int-1',
      sourceSnapshotRefs: ['snap-1'],
      cityPackGrounded: true,
      emergencyContextActive: true,
      savedFaqReused: true,
      taskBlockerDetected: true,
      journeyPhase: 'housing'
    }],
    sourceEvidence: [{ traceId: 'trace-int-1' }],
    faqAnswerLogs: [{ traceId: 'trace-int-1' }],
    emergencyEvents: [{ traceId: 'trace-int-1' }],
    emergencyBulletins: [],
    cityPackBulletins: [{ traceId: 'trace-int-1' }],
    taskEvents: [{ traceId: 'trace-int-1' }],
    journeyBranchQueue: [{ traceId: 'trace-int-1' }]
  });

  assert.equal(joinSummary.completeness, 1);
  assert.deepEqual(joinSummary.missingDomains, []);

  const traceSearchRows = buildTraceSearchAuditRows([{
    traceId: 'trace-int-1',
    createdAt: '2026-03-12T11:00:00.000Z',
    payloadSummary: {
      traceId: 'trace-int-1',
      traceJoinCompleteness: 1,
      adminTraceResolutionTimeMs: 1200,
      joinedDomains: joinSummary.joinedDomains,
      missingDomains: [],
      joinedDomainCount: joinSummary.joinedDomains.length,
      missingDomainCount: 0,
      emergencyOverrideApplied: true,
      emergencyOverrideAppliedObserved: true,
      savedFaqReusePass: true,
      savedFaqReusePassObserved: true
    }
  }]);

  const traceProbeRows = [{
    traceId: 'trace-int-1',
    createdAt: '2026-03-12T11:00:01.000Z',
    traceJoinCompleteness: 1,
    adminTraceResolutionTimeMs: 1200,
    traceBundleLoadMs: 20,
    joinedDomains: joinSummary.joinedDomains,
    missingDomains: [],
    expectedDomains: joinSummary.expectedDomains,
    criticalMissingDomains: [],
    joinedDomainCount: joinSummary.joinedDomains.length,
    missingDomainCount: 0,
    cityPackGrounded: true,
    cityPackGroundedObserved: true,
    emergencyOfficialSourceSatisfied: true,
    emergencyOfficialSourceSatisfiedObserved: true,
    emergencyOverrideApplied: true,
    emergencyOverrideAppliedObserved: true,
    journeyAlignedAction: true,
    journeyAlignedActionObserved: true,
    savedFaqReusePass: true,
    savedFaqReusePassObserved: true,
    provenance: 'trace_bundle_probe'
  }];

  const merged = mergeTraceAuditRows(traceSearchRows, traceProbeRows);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].savedFaqReusePass, true);
  assert.equal(merged[0].emergencyOverrideApplied, true);

  const summary = buildQualityLoopV2Summary({
    actionRows: [],
    faqRows: [{
      createdAt: '2026-03-12T11:00:02.000Z',
      savedFaqReusePass: true,
      savedFaqReusePassObserved: true
    }],
    traceSearchAuditRows: traceSearchRows,
    traceProbeRows,
    conversationQuality: { sampleCount: 1 },
    optimization: { compatShareWindow: 0.04 }
  });

  assert.equal(summary.integrationKpis.traceJoinCompleteness.sampleCount, 1);
  assert.equal(summary.integrationKpis.traceJoinCompleteness.value, 1);
  assert.equal(summary.integrationKpis.adminTraceResolutionTime.valueMs, 1200);
  assert.equal(summary.integrationKpis.savedFaqReusePassRate.status, 'pass');
  assert.equal(summary.integrationKpis.emergencyOverrideAppliedRate.sampleCount, 1);
});
