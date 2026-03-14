'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPatrolQueryResponse } = require('../../src/domain/qualityPatrol/query/buildPatrolQueryResponse');
const { buildFixture } = require('./phase853_helpers');

test('phase853: human audience hides trace references and raw trace ids from evidence', () => {
  const fixture = buildFixture();
  const result = buildPatrolQueryResponse({
    audience: 'human',
    mode: 'latest',
    reviewUnits: fixture.reviewUnits,
    metrics: fixture.kpiResult.metrics,
    kpiSummary: fixture.kpiResult.summary,
    issues: fixture.detectionResult.issueCandidates,
    rootCauseReports: fixture.rootCauseResult.rootCauseReports,
    recommendedPr: fixture.planResult.recommendedPr,
    planObservationBlockers: fixture.planResult.observationBlockers,
    planningStatus: fixture.planResult.planningStatus
  });

  assert.equal(result.traceRefs.length, 0);
  assert.ok(result.evidence.every((item) => item.traceId === null));
});
