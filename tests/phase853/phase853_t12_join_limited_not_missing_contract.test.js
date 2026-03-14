'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPatrolQueryResponse } = require('../../src/domain/qualityPatrol/query/buildPatrolQueryResponse');

test('phase853: trace hydration limits are surfaced as join-limited blockers instead of source-missing blockers', () => {
  const result = buildPatrolQueryResponse({
    audience: 'operator',
    mode: 'latest',
    reviewUnits: [{
      reviewUnitId: 'ru_join_limited_1',
      evidenceJoinStatus: {
        actionLog: 'joined',
        trace: 'limited_by_trace_hydration',
        faq: 'not_expected'
      }
    }],
    joinDiagnostics: {
      faqOnlyRowsSkipped: 0,
      traceHydrationLimitedCount: 2,
      reviewUnitAnchorKindCounts: { action_only: 4 }
    },
    metrics: {},
    kpiSummary: { overallStatus: 'blocked' },
    issues: [],
    rootCauseReports: [{
      issueKey: 'issue_trace_blocked',
      slice: 'other',
      causeCandidates: [{ causeType: 'observation_gap', rank: 1, confidence: 'medium' }],
      observationBlockers: [],
      analysisStatus: 'blocked'
    }],
    recommendedPr: [{
      proposalKey: 'proposal_observation_gap',
      proposalType: 'blocked_by_observation_gap',
      priority: 'P1',
      title: 'Quality Patrol observation gap unblocker',
      objective: 'Close observation gaps before proposing runtime fixes.',
      whyNow: 'issue_trace_blocked is still blocked by observation gaps.',
      riskLevel: 'low',
      blockedBy: ['trace_hydration_limit']
    }],
    planningStatus: 'blocked'
  });

  assert.ok(result.observationBlockers.some((item) => item.code === 'action_trace_join_limited'));
  assert.ok(result.observationBlockers.every((item) => item.code !== 'trace_source_missing'));
  assert.ok(result.observationBlockers.find((item) => item.code === 'action_trace_join_limited').summary.includes('traceHydrationLimitedCount=2'));
});
