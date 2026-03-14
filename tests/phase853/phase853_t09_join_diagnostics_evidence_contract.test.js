'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPatrolQueryResponse } = require('../../src/domain/qualityPatrol/query/buildPatrolQueryResponse');
const { buildFixture } = require('./phase853_helpers');

test('phase853: operator view surfaces join diagnostics while human view keeps them collapsed', () => {
  const fixture = buildFixture();
  const shared = {
    generatedAt: '2026-03-14T12:00:00.000Z',
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
    sourceCollections: fixture.planResult.sourceCollections,
    joinDiagnostics: {
      faqOnlyRowsSkipped: 8,
      traceHydrationLimitedCount: 2,
      reviewUnitAnchorKindCounts: { action_only: 3, snapshot_action: 1 }
    }
  };

  const operator = buildPatrolQueryResponse(Object.assign({}, shared, { audience: 'operator' }));
  const human = buildPatrolQueryResponse(Object.assign({}, shared, { audience: 'human' }));

  assert.ok(operator.evidence.some((row) =>
    row.provenance === 'quality_patrol_review_unit_join'
    && /faqOnlyRowsSkipped=8/.test(row.summary)
    && /traceHydrationLimitedCount=2/.test(row.summary)
  ));
  assert.ok(!human.evidence.some((row) => row.provenance === 'quality_patrol_review_unit_join'));
  assert.equal(operator.queryVersion, human.queryVersion);
  assert.ok(Array.isArray(operator.issues));
  assert.ok(Array.isArray(human.issues));
});
