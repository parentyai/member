'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPatrolQueryResponse } = require('../../src/domain/qualityPatrol/query/buildPatrolQueryResponse');
const { buildFixture, buildRecommendedPr } = require('./phase853_helpers');

test('phase853: next-best-pr mode returns top proposals in priority order', () => {
  const fixture = buildFixture({
    planResult: {
      ok: true,
      planVersion: 'quality_patrol_improvement_plan_v1',
      generatedAt: '2026-03-14T12:00:00.000Z',
      summary: { topPriorityCount: 3, observationOnlyCount: 0, runtimeFixCount: 3 },
      recommendedPr: [
        buildRecommendedPr({ proposalKey: 'proposal_p2', priority: 'P2', title: 'Fallback template diversification' }),
        buildRecommendedPr({ proposalKey: 'proposal_p0', priority: 'P0', title: 'Transcript coverage repair', proposalType: 'transcript_coverage_repair' }),
        buildRecommendedPr({ proposalKey: 'proposal_p1', priority: 'P1', title: 'City specificity grounding repair' }),
        buildRecommendedPr({ proposalKey: 'proposal_p3', priority: 'P3', title: 'No action until evidence', proposalType: 'no_action_until_evidence' })
      ],
      observationBlockers: [],
      planningStatus: 'planned'
    }
  });

  const result = buildPatrolQueryResponse({
    audience: 'operator',
    mode: 'next-best-pr',
    reviewUnits: fixture.reviewUnits,
    metrics: fixture.kpiResult.metrics,
    kpiSummary: fixture.kpiResult.summary,
    issues: fixture.detectionResult.issueCandidates,
    rootCauseReports: fixture.rootCauseResult.rootCauseReports,
    recommendedPr: fixture.planResult.recommendedPr,
    planObservationBlockers: fixture.planResult.observationBlockers,
    planningStatus: fixture.planResult.planningStatus
  });

  assert.ok(result.recommendedPr.length <= 3);
  assert.deepEqual(result.recommendedPr.map((item) => item.priority), ['P0', 'P1', 'P2']);
});
