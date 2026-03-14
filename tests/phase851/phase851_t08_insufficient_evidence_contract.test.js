'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { analyzeRootCauses } = require('../../src/domain/qualityPatrol/analyzeRootCauses');
const { buildDetectionResult } = require('./phase851_helpers');

test('phase851: insufficient evidence stays insufficient instead of inventing runtime causes', () => {
  const detectionResult = buildDetectionResult({
    metricKey: 'naturalness',
    category: 'naturalness_degraded',
    issueType: 'conversation_quality',
    supportingEvidence: []
  });
  const result = analyzeRootCauses({
    detectionResult,
    kpiResult: null,
    reviewUnits: [],
    evaluations: [],
    traceBundles: []
  });

  const report = result.rootCauseReports[0];
  assert.equal(report.analysisStatus, 'insufficient_evidence');
  assert.equal(report.causeCandidates[0].causeType, 'evidence_insufficient');
});
