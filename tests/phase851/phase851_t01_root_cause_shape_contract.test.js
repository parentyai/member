'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { analyzeRootCauses } = require('../../src/domain/qualityPatrol/analyzeRootCauses');
const { buildDetectionResult, buildKpiResult, buildReviewContext } = require('./phase851_helpers');

test('phase851: root cause analyzer returns planner-ready shape', () => {
  const detectionResult = buildDetectionResult();
  const context = buildReviewContext();
  const result = analyzeRootCauses({
    detectionResult,
    kpiResult: buildKpiResult('knowledgeActivationMissingRate'),
    reviewUnits: context.reviewUnits,
    evaluations: context.evaluations,
    traceBundles: context.traceBundles
  });

  assert.equal(result.provenance, 'quality_patrol_root_cause_analysis');
  assert.equal(result.summary.reportCount, 1);
  assert.equal(result.rootCauseReports.length, 1);
  assert.equal(result.rootCauseReports[0].issueKey, detectionResult.issueCandidates[0].issueKey);
  assert.ok(Array.isArray(result.rootCauseReports[0].causeCandidates));
  assert.equal(result.rootCauseReports[0].causeCandidates[0].rank, 1);
  assert.match(result.rootCauseReports[0].rootCauseSummary, /cause|evidence|Analysis/i);
});
