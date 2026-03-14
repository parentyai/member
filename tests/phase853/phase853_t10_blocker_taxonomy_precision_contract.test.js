'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPatrolQueryResponse } = require('../../src/domain/qualityPatrol/query/buildPatrolQueryResponse');

test('phase853: blocker taxonomy separates observation gap, transcript coverage, and insufficient runtime evidence', () => {
  const result = buildPatrolQueryResponse({
    audience: 'operator',
    mode: 'latest',
    reviewUnits: [{
      reviewUnitId: 'ru_taxonomy_1',
      evidenceJoinStatus: {
        actionLog: 'joined',
        trace: 'joined',
        faq: 'not_expected'
      }
    }],
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
        { code: 'missing_assistant_reply', severity: 'high', message: 'Masked assistant reply snapshot is unavailable.', source: 'conversation_review_snapshots' },
        { code: 'transcript_not_reviewable', severity: 'high', message: 'Conversation transcript is not reviewable because required masked text is missing.', source: 'conversation_review_snapshots' },
        { code: 'insufficient_knowledge_signals', severity: 'low', message: 'knowledge-use judgement needs candidate availability or reuse signals', source: 'conversation_quality_evaluator' }
      ]
    }],
    rootCauseReports: [{
      issueKey: 'issue_quality_blocked',
      slice: 'housing',
      causeCandidates: [{ causeType: 'observation_gap', rank: 1, confidence: 'medium' }],
      observationBlockers: [
        { code: 'missing_user_message', severity: 'high', message: 'Masked user message snapshot is unavailable.', source: 'conversation_review_snapshots' },
        { code: 'insufficient_knowledge_signals', severity: 'low', message: 'knowledge-use judgement needs candidate availability or reuse signals', source: 'conversation_quality_evaluator' }
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
      blockedBy: ['missing_user_message', 'insufficient_knowledge_signals']
    }],
    planningStatus: 'blocked'
  });

  assert.deepEqual(
    result.observationBlockers.map((item) => item.code),
    ['observation_gap', 'transcript_write_coverage_missing', 'insufficient_runtime_evidence']
  );
  assert.equal(result.observationBlockers[0].category, 'observation_gap');
  assert.equal(result.observationBlockers[1].category, 'write_coverage_missing');
  assert.equal(result.observationBlockers[2].category, 'insufficient_evidence');
  assert.ok(result.observationBlockers[1].summary.includes('no transcript write outcomes'));
});
