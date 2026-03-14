'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { runAnswerReadinessGateV2 } = require('../../src/domain/llm/quality/runAnswerReadinessGateV2');

test('phase831: emergency context refuses when official source is not satisfied', () => {
  const result = runAnswerReadinessGateV2({
    entryType: 'webhook',
    lawfulBasis: 'consent',
    consentVerified: true,
    legalDecision: 'allow',
    intentRiskTier: 'high',
    sourceAuthorityScore: 0.95,
    sourceFreshnessScore: 0.95,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    officialOnlySatisfiedObserved: true,
    evidenceCoverage: 0.95,
    evidenceCoverageObserved: true,
    emergencyContext: true,
    emergencySeverity: 'high',
    emergencyOfficialSourceSatisfied: false,
    emergencyEventId: 'evt-001',
    emergencyRegionKey: 'us-ny'
  });

  assert.equal(result.readinessV2.decision, 'refuse');
  assert.ok(result.readinessV2.reasonCodes.includes('emergency_official_source_missing'));
  assert.equal(result.telemetry.emergencyContextActive, true);
  assert.equal(result.telemetry.emergencyOfficialSourceSatisfied, false);
  assert.equal(result.telemetry.emergencyOverrideApplied, true);
  assert.equal(result.telemetry.emergencyEventId, 'evt-001');
  assert.equal(result.telemetry.emergencyRegionKey, 'us-ny');
});
