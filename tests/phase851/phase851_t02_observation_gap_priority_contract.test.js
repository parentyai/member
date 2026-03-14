'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { analyzeRootCauses } = require('../../src/domain/qualityPatrol/analyzeRootCauses');
const { buildDetectionResult, buildKpiResult } = require('./phase851_helpers');

test('phase851: observation gap is ranked first when blockers are the primary issue', () => {
  const detectionResult = buildDetectionResult({
    issueType: 'observation_blocker',
    category: 'transcript_availability_low',
    metricKey: 'transcriptAvailability',
    metricStatus: 'blocked',
    status: 'blocked',
    observationBlockers: [{ code: 'transcript_not_reviewable', severity: 'high', source: 'transcript' }]
  });
  const result = analyzeRootCauses({
    detectionResult,
    kpiResult: buildKpiResult('transcriptAvailability', {
      value: 0,
      sampleCount: 4,
      blockedCount: 4,
      status: 'blocked',
      observationBlockers: [{ code: 'transcript_not_reviewable', severity: 'high', source: 'transcript' }]
    }),
    reviewUnits: [],
    evaluations: [],
    traceBundles: []
  });

  const report = result.rootCauseReports[0];
  assert.equal(report.analysisStatus, 'blocked');
  assert.equal(report.causeCandidates[0].causeType, 'observation_gap');
  assert.ok(report.causeCandidates.some((item) => item.causeType === 'transcript_unavailable'));
});
