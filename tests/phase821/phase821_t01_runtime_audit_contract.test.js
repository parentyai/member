'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildRuntimeAuditReport, buildUnavailableAuditReport } = require('../../tools/run_llm_runtime_audit');

function gateRow(overrides) {
  return {
    createdAt: '2026-03-12T10:00:00.000Z',
    payloadSummary: Object.assign({
      decision: 'allow',
      entryType: 'webhook',
      assistantQuality: { evidenceCoverage: 0.92 }
    }, overrides || {})
  };
}

function actionRow(overrides) {
  return Object.assign({
    createdAt: '2026-03-12T10:01:00.000Z',
    intentRiskTier: 'high',
    officialOnlySatisfied: true,
    contradictionDetected: false,
    unsupportedClaimCount: 0,
    readinessDecisionV2: 'allow',
    fallbackType: 'none',
    cityPackGrounded: true,
    cityPackFreshnessScore: 0.92,
    cityPackAuthorityScore: 0.94,
    emergencyContextActive: true,
    emergencyOfficialSourceSatisfied: true,
    journeyPhase: 'phase_a',
    taskBlockerDetected: false,
    journeyAlignedAction: true,
    savedFaqReused: true,
    savedFaqReusePass: true
  }, overrides || {});
}

test('phase821: runtime audit report exposes required KPIs with thresholds and sources', () => {
  const report = buildRuntimeAuditReport({
    fromAt: '2026-03-12T00:00:00.000Z',
    toAt: '2026-03-12T23:59:59.000Z',
    limit: 100,
    gateAuditRows: [gateRow(), gateRow({ assistantQuality: { evidenceCoverage: 0.88 } })],
    actionRows: [
      actionRow(),
      actionRow({ intentRiskTier: 'medium', readinessDecisionV2: 'clarify', emergencyContextActive: false }),
      actionRow({ contradictionDetected: true, unsupportedClaimCount: 1, fallbackType: 'knowledge_gap', cityPackGrounded: false, emergencyContextActive: false, savedFaqReused: false })
    ],
    qualityRows: [{ createdAt: '2026-03-12T10:02:00.000Z', sliceKey: 'paid' }],
    faqRows: [{ createdAt: '2026-03-12T10:03:00.000Z', savedFaqReused: true, savedFaqReusePass: true }]
  });

  assert.equal(report.auditVersion, 'v3');
  [
    'contradictionRate',
    'unsupportedClaimRate',
    'evidenceCoverage',
    'clarifyRateByTier',
    'officialSourceUsageRate',
    'fallbackRateByCause',
    'compatShareWindow',
    'cityPackGroundingRate',
    'emergencyOfficialSourceRate',
    'journeyAlignedActionRate',
    'savedFaqReusePassRate'
  ].forEach((key) => {
    assert.ok(report.kpis[key], key);
    assert.ok(Object.prototype.hasOwnProperty.call(report.kpis[key], 'sampleCount'));
    assert.ok(Object.prototype.hasOwnProperty.call(report.kpis[key], 'status'));
    assert.ok(Array.isArray(report.kpis[key].sourceCollections));
  });

  assert.ok(Array.isArray(report.topFailures));
  assert.ok(Array.isArray(report.missingMeasurements));
  assert.ok(Array.isArray(report.releaseBlockers));
});

test('phase821: runtime audit marks zero-sample KPIs as missing instead of throwing', () => {
  const report = buildRuntimeAuditReport({
    gateAuditRows: [],
    actionRows: [],
    qualityRows: [],
    faqRows: []
  });

  assert.equal(report.kpis.contradictionRate.status, 'missing');
  assert.equal(report.kpis.evidenceCoverage.status, 'missing');
  assert.ok(report.missingMeasurements.includes('contradictionRate'));
  assert.ok(report.missingMeasurements.includes('savedFaqReusePassRate'));
});

test('phase821: runtime audit unavailable report stays structured and marks the fetch status', () => {
  const report = buildUnavailableAuditReport({
    fromAt: '2026-03-12T00:00:00.000Z',
    toAt: '2026-03-12T23:59:59.000Z',
    limit: 25,
    error: Object.assign(new Error('reauth related error (invalid_rapt)'), { code: 'invalid_rapt' })
  });

  assert.equal(report.source.runtimeFetchStatus, 'unavailable');
  assert.equal(report.source.runtimeFetchErrorCode, 'invalid_rapt');
  assert.ok(report.releaseBlockers.includes('runtimeAuditUnavailable'));
  assert.ok(report.missingMeasurements.includes('contradictionRate'));
});
