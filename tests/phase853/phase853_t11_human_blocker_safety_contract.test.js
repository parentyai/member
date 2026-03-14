'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPatrolQueryResponse } = require('../../src/domain/qualityPatrol/query/buildPatrolQueryResponse');

test('phase853: human blocker wording stays privacy-safe and avoids misleading internal phrasing', () => {
  const result = buildPatrolQueryResponse({
    audience: 'human',
    mode: 'newly-detected-improvements',
    reviewUnits: [],
    transcriptCoverage: {
      observedCount: 0,
      transcriptCoverageStatus: 'unavailable',
      transcriptWriteOutcomeCounts: {},
      transcriptWriteFailureReasons: {}
    },
    metrics: {},
    kpiSummary: { overallStatus: 'blocked' },
    issues: [{
      issueKey: 'issue_quality_blocked',
      title: 'Knowledge judgement is blocked',
      summary: 'blockedKnowledgeJudgementRate coverage is degraded for global',
      severity: 'high',
      status: 'blocked',
      category: 'blockedKnowledgeJudgementRate',
      observationBlockers: [
        { code: 'missing_user_message', severity: 'high', message: 'Masked user message snapshot is unavailable.', source: 'conversation_review_snapshots' },
        { code: 'insufficient_knowledge_signals', severity: 'low', message: 'knowledge-use judgement needs candidate availability or reuse signals', source: 'conversation_quality_evaluator' }
      ]
    }],
    rootCauseReports: [{
      issueKey: 'issue_quality_blocked',
      slice: 'other',
      causeCandidates: [{ causeType: 'observation_gap', rank: 1, confidence: 'medium' }],
      observationBlockers: [
        { code: 'missing_user_message', severity: 'high', message: 'Masked user message snapshot is unavailable.', source: 'conversation_review_snapshots' }
      ],
      analysisStatus: 'blocked'
    }],
    recommendedPr: [{
      proposalKey: 'proposal_observation_gap',
      proposalType: 'blocked_by_observation_gap',
      priority: 'P1',
      title: 'Quality Patrol observation gap unblocker',
      objective: 'Close observation gaps before proposing runtime fixes.',
      whyNow: 'issue_quality_blocked is still blocked by observation gaps.',
      riskLevel: 'low',
      blockedBy: ['missing_user_message']
    }],
    planningStatus: 'blocked'
  });

  assert.ok(result.observationBlockers.every((item) => item.detailVisibility === 'privacy_hidden_detail'));
  assert.ok(result.observationBlockers.every((item) => String(item.title).startsWith('まだ断定できない理由: ')));
  assert.ok(result.summary.topFindings.every((item) => !/Knowledge judgement is blocked|Masked user message snapshot/.test(item)));
  assert.ok(result.summary.topFindings.some((item) => item.includes('証跡不足')));
  assert.ok(result.observationBlockers.every((item) => !('sourceCodes' in item)));
});
