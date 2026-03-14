'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPatrolQueryResponse } = require('../../src/domain/qualityPatrol/query/buildPatrolQueryResponse');
const { buildFixture, buildRootCauseReport, buildRecommendedPr } = require('./phase853_helpers');

test('phase853: blocker-first rule prioritizes observation blockers over runtime proposals', () => {
  const fixture = buildFixture({
    rootCauseResult: {
      summary: {},
      rootCauseReports: [buildRootCauseReport({
        issueKey: 'issue_followup_blocked',
        slice: 'follow-up',
        rootCauseSummary: 'Analysis blocked: observation gap',
        causeCandidates: [{
          causeType: 'observation_gap',
          confidence: 'medium',
          rank: 1,
          supportingSignals: ['observation_gap'],
          supportingEvidence: [],
          evidenceGaps: ['missing_trace_bundles'],
          upstreamLayer: 'detection',
          downstreamImpact: ['followupContextResetRate']
        }],
        observationBlockers: [{ code: 'insufficient_context_for_followup_judgement', severity: 'high', message: 'Prior context is missing.', source: 'review_unit' }],
        analysisStatus: 'blocked'
      })]
    },
    planResult: {
      ok: true,
      planVersion: 'quality_patrol_improvement_plan_v1',
      generatedAt: '2026-03-14T12:00:00.000Z',
      summary: { topPriorityCount: 1, observationOnlyCount: 1, runtimeFixCount: 1 },
      recommendedPr: [
        buildRecommendedPr({
          proposalKey: 'proposal_observation_block',
          proposalType: 'blocked_by_observation_gap',
          title: 'Quality Patrol observation gap unblocker',
          objective: 'Close observation gaps before proposing runtime fixes.',
          whyNow: 'issue_followup_blocked is still blocked by observation gaps.',
          targetFiles: ['docs/QUALITY_PATROL_TRANSCRIPT_RUNBOOK.md']
        }),
        buildRecommendedPr({
          proposalKey: 'proposal_runtime_followup',
          proposalType: 'continuity_fix',
          title: 'Follow-up continuity repair',
          objective: 'Carry prior context more reliably.',
          targetFiles: ['src/domain/llm/orchestrator/buildConversationPacket.js']
        })
      ],
      observationBlockers: [{ code: 'insufficient_context_for_followup_judgement', severity: 'high', message: 'Prior context is missing.', source: 'review_unit' }],
      planningStatus: 'blocked'
    }
  });

  const result = buildPatrolQueryResponse({
    audience: 'operator',
    mode: 'observation-blockers',
    reviewUnits: fixture.reviewUnits,
    metrics: fixture.kpiResult.metrics,
    kpiSummary: { overallStatus: 'blocked' },
    issues: fixture.detectionResult.issueCandidates,
    rootCauseReports: fixture.rootCauseResult.rootCauseReports,
    recommendedPr: fixture.planResult.recommendedPr,
    planObservationBlockers: fixture.planResult.observationBlockers,
    planningStatus: fixture.planResult.planningStatus
  });

  assert.equal(result.summary.overallStatus, 'blocked');
  assert.equal(result.observationBlockers.length, 1);
  assert.equal(result.recommendedPr[0].proposalType, 'blocked_by_observation_gap');
});
