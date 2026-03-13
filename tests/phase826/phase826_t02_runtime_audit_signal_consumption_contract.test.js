'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildRuntimeAuditReport } = require('../../tools/run_llm_runtime_audit');

function gateRow(overrides) {
  return {
    createdAt: '2026-03-12T10:00:00.000Z',
    payloadSummary: Object.assign({
      decision: 'allow',
      entryType: 'webhook'
    }, overrides || {})
  };
}

function actionRow(overrides) {
  return Object.assign({
    createdAt: '2026-03-12T10:01:00.000Z',
    intentRiskTier: 'high',
    officialOnlySatisfied: true,
    officialOnlySatisfiedObserved: true,
    contradictionDetected: false,
    unsupportedClaimCount: 0,
    readinessDecisionV2: 'allow',
    fallbackType: 'none',
    cityPackGrounded: true,
    cityPackGroundedObserved: true,
    cityPackFreshnessScore: 0.92,
    cityPackAuthorityScore: 0.94,
    staleSourceBlocked: false,
    staleSourceBlockedObserved: true,
    emergencyOfficialSourceSatisfied: true,
    emergencyOfficialSourceSatisfiedObserved: true,
    journeyAlignedAction: true,
    journeyAlignedActionObserved: true,
    savedFaqReused: true,
    savedFaqReusePass: true,
    savedFaqReusePassObserved: true,
    evidenceCoverage: 0.91,
    evidenceCoverageObserved: true,
    traceId: 'trace-live-1'
  }, overrides || {});
}

test('phase826: runtime audit consumes restored telemetry signals with missingCount and provenance', () => {
  const report = buildRuntimeAuditReport({
    fromAt: '2026-03-12T00:00:00.000Z',
    toAt: '2026-03-12T23:59:59.000Z',
    limit: 100,
    gateAuditRows: [gateRow({ traceId: 'trace-live-1' })],
    actionRows: [actionRow()],
    qualityRows: [],
    faqRows: [],
    traceSearchAuditRows: [{ traceId: 'trace-live-1', createdAt: '2026-03-12T10:05:00.000Z' }],
    traceProbeRows: [{
      traceId: 'trace-live-1',
      createdAt: '2026-03-12T10:05:00.000Z',
      traceJoinCompleteness: 0.95,
      adminTraceResolutionTimeMs: 450000,
      traceBundleLoadMs: 100,
      joinedDomains: ['llm_action_logs', 'faq_answer_logs'],
      missingDomains: [],
      joinedDomainCount: 2,
      missingDomainCount: 0,
      provenance: 'trace_bundle_probe'
    }]
  });

  [
    'cityPackGroundingRate',
    'staleSourceBlockRate',
    'emergencyOfficialSourceRate',
    'journeyAlignedActionRate',
    'savedFaqReusePassRate',
    'traceJoinCompleteness',
    'adminTraceResolutionTime',
    'adminTraceResolutionTimeMs',
    'evidenceCoverage',
    'officialSourceUsageRate'
  ].forEach((key) => {
    assert.ok(report.kpis[key], key);
    assert.ok(Object.prototype.hasOwnProperty.call(report.kpis[key], 'missingCount'), key);
    assert.ok(Object.prototype.hasOwnProperty.call(report.kpis[key], 'provenance'), key);
  });

  assert.equal(report.kpis.traceJoinCompleteness.status, 'pass');
  assert.equal(report.kpis.adminTraceResolutionTimeMs.sampleCount, 1);
});
