'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPatrolQueryResponse } = require('../../src/domain/qualityPatrol/query/buildPatrolQueryResponse');
const { buildFixture } = require('./phase853_helpers');

test('phase853: operator and human audiences receive different evidence density', () => {
  const fixture = buildFixture();
  const payload = {
    mode: 'latest',
    reviewUnits: fixture.reviewUnits,
    metrics: Object.assign({}, fixture.kpiResult.metrics, fixture.kpiResult.issueCandidateMetrics),
    kpiSummary: fixture.kpiResult.summary,
    issues: fixture.detectionResult.issueCandidates,
    rootCauseReports: fixture.rootCauseResult.rootCauseReports,
    recommendedPr: fixture.planResult.recommendedPr,
    planningStatus: fixture.planResult.planningStatus,
    existingIssues: fixture.existingIssues,
    existingBacklog: fixture.existingBacklog
  };

  const operator = buildPatrolQueryResponse(Object.assign({}, payload, { audience: 'operator' }));
  const human = buildPatrolQueryResponse(Object.assign({}, payload, { audience: 'human' }));

  assert.ok(operator.traceRefs.length > 0);
  assert.equal(human.traceRefs.length, 0);
  assert.ok(operator.recommendedPr[0].whyNotOthers);
  assert.equal('whyNotOthers' in human.recommendedPr[0], false);
  assert.notEqual(operator.summary.topFindings[0], human.summary.topFindings[0]);
});
