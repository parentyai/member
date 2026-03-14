'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { normalizeReviewEvidence } = require('../../src/domain/qualityPatrol/transcript/normalizeReviewEvidence');

test('phase847: normalizeReviewEvidence dedupes refs and carries trace join summary safely', () => {
  const result = normalizeReviewEvidence({
    snapshot: {
      id: 'snapshot_1',
      traceId: 'trace_phase847_evidence',
      createdAt: '2026-03-14T17:00:00.000Z',
      userMessageAvailable: true,
      assistantReplyAvailable: true,
      priorContextSummaryAvailable: false
    },
    llmActions: [
      {
        id: 'action_1',
        traceId: 'trace_phase847_evidence',
        createdAt: '2026-03-14T17:00:01.000Z',
        routeKind: 'paid',
        strategyReason: 'explicit_domain_grounded_answer',
        selectedCandidateKind: 'grounded_candidate'
      },
      {
        id: 'action_1',
        traceId: 'trace_phase847_evidence',
        createdAt: '2026-03-14T17:00:01.000Z',
        routeKind: 'paid',
        strategyReason: 'explicit_domain_grounded_answer',
        selectedCandidateKind: 'grounded_candidate'
      }
    ],
    faqAnswerLogs: [
      {
        id: 'faq_1',
        traceId: 'trace_phase847_evidence',
        createdAt: '2026-03-14T17:00:02.000Z',
        matchedArticleIds: ['faq_1']
      }
    ],
    traceBundle: {
      ok: true,
      traceId: 'trace_phase847_evidence',
      traceJoinSummary: {
        completeness: 0.75,
        joinedDomains: ['llmActions', 'faq'],
        missingDomains: ['sourceEvidence'],
        criticalMissingDomains: ['sourceEvidence']
      }
    }
  });

  assert.equal(result.evidenceRefs.length, 4);
  assert.deepEqual(result.sourceCollections, [
    'conversation_review_snapshots',
    'llm_action_logs',
    'faq_answer_logs',
    'trace_bundle'
  ]);
  const traceRef = result.evidenceRefs.find((row) => row.source === 'trace_bundle');
  assert.equal(traceRef.summary, 'completeness:0.75');
});
