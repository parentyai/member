'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { queryLatestPatrolInsights } = require('../../src/usecases/qualityPatrol/queryLatestPatrolInsights');
const { buildFixture, buildIssueCandidate, buildRootCauseReport, buildRecommendedPr } = require('./phase853_helpers');

test('phase853: newly-detected-improvements prioritizes new issues and proposals', async () => {
  const fixture = buildFixture({
    detectionResult: {
      summary: {},
      issueCandidates: [
        buildIssueCandidate(),
        buildIssueCandidate({
          issueKey: 'issue_broad_new',
          metricKey: 'broadAbstractEscapeRate',
          category: 'broad_abstract_escape',
          title: 'Broad answers are drifting into abstraction',
          summary: 'Broad replies stay too generic.',
          slice: 'broad',
          severity: 'medium'
        })
      ],
      backlogCandidates: [],
      provenance: 'quality_patrol_detection',
      sourceCollections: ['conversation_review_snapshots']
    },
    rootCauseResult: {
      summary: {},
      rootCauseReports: [
        buildRootCauseReport(),
        buildRootCauseReport({
          issueKey: 'issue_broad_new',
          slice: 'broad',
          rootCauseSummary: 'Most likely cause: Procedural guidance gap',
          causeCandidates: [{
            causeType: 'procedural_guidance_gap',
            confidence: 'medium',
            rank: 1,
            supportingSignals: ['next_step_missing'],
            supportingEvidence: [],
            evidenceGaps: [],
            upstreamLayer: 'runtime_telemetry',
            downstreamImpact: ['nextStepMissingRate']
          }]
        })
      ],
      provenance: 'quality_patrol_root_cause_analysis',
      sourceCollections: ['conversation_review_snapshots']
    },
    planResult: {
      ok: true,
      planVersion: 'quality_patrol_improvement_plan_v1',
      generatedAt: '2026-03-14T12:00:00.000Z',
      summary: { topPriorityCount: 2, observationOnlyCount: 0, runtimeFixCount: 2 },
      recommendedPr: [
        buildRecommendedPr(),
        buildRecommendedPr({
          proposalKey: 'proposal_broad_new',
          proposalType: 'runtime_fix',
          title: 'Procedural guidance repair',
          objective: 'Increase concrete next-step guidance in broad and housing answers.',
          whyNow: 'issue_broad_new now has a ranked root cause.',
          whyNotOthers: 'Observation-only work is no longer the main blocker.',
          targetFiles: ['src/domain/llm/orchestrator/runPaidConversationOrchestrator.js']
        })
      ],
      observationBlockers: [],
      planningStatus: 'planned',
      provenance: 'quality_patrol_improvement_planner',
      sourceCollections: ['conversation_review_snapshots']
    },
    existingIssues: [{ layer: 'conversation', category: 'city_specificity_missing', slice: 'city' }],
    existingBacklog: [{ title: 'City specificity grounding repair', objective: 'Increase city-specific grounding so city replies stop collapsing into generic guidance.', priority: 'p1' }]
  });

  const result = await queryLatestPatrolInsights({
    mode: 'newly-detected-improvements',
    audience: 'human',
    reviewUnits: fixture.reviewUnits,
    evaluations: fixture.evaluations,
    kpiResult: fixture.kpiResult,
    detectionResult: fixture.detectionResult,
    rootCauseResult: Object.assign({}, fixture.rootCauseResult, { detectionResult: fixture.detectionResult, kpiResult: fixture.kpiResult }),
    planResult: fixture.planResult
  }, {
    listOpenIssues: async () => fixture.existingIssues,
    listTopPriorityBacklog: async () => fixture.existingBacklog
  });

  assert.equal(result.summary.topFindings[0].includes('新しく検知'), true);
  assert.equal(result.issues[0].changeStatus, 'new');
  assert.equal(result.recommendedPr[0].changeStatus, 'new');
  assert.ok(result.recommendedPr.length <= 3);
});
