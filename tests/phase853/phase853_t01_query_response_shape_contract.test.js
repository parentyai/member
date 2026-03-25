'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPatrolQueryResponse } = require('../../src/domain/qualityPatrol/query/buildPatrolQueryResponse');
const { buildFixture } = require('./phase853_helpers');

test('phase853: query response returns fixed shape for latest mode', () => {
  const fixture = buildFixture();
  const result = buildPatrolQueryResponse({
    generatedAt: '2026-03-14T12:00:00.000Z',
    audience: 'operator',
    mode: 'latest',
    reviewUnits: fixture.reviewUnits,
    metrics: Object.assign({}, fixture.kpiResult.metrics, fixture.kpiResult.issueCandidateMetrics),
    kpiSummary: fixture.kpiResult.summary,
    issues: fixture.detectionResult.issueCandidates,
    rootCauseReports: fixture.rootCauseResult.rootCauseReports,
    recommendedPr: fixture.planResult.recommendedPr,
    planObservationBlockers: fixture.planResult.observationBlockers,
    planningStatus: fixture.planResult.planningStatus,
    existingIssues: fixture.existingIssues,
    existingBacklog: fixture.existingBacklog,
    sourceCollections: fixture.planResult.sourceCollections
  });

  assert.equal(result.queryVersion, 'quality_patrol_query_v1');
  assert.equal(result.audience, 'operator');
  assert.equal(result.summary.overallStatus, 'fail');
  assert.ok(Array.isArray(result.summary.topFindings));
  assert.ok(result.evidenceAvailability);
  assert.equal(typeof result.evidenceAvailability.status, 'string');
  assert.ok(Array.isArray(result.issues));
  assert.ok(Array.isArray(result.observationBlockers));
  assert.ok(Array.isArray(result.evidence));
  assert.ok(Array.isArray(result.traceRefs));
  assert.ok(Array.isArray(result.recommendedPr));
  assert.equal(result.observationStatus, 'ready');
  assert.ok(Array.isArray(result.sourceCollections));
});
