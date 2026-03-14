'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationQualitySummary } = require('../../src/routes/admin/osLlmUsageSummary');
const { buildTraceJoinSummary } = require('../../src/usecases/admin/getTraceBundle');

test('phase834: summary and trace expose knowledge activation telemetry', () => {
  const summary = buildConversationQualitySummary([
    {
      createdAt: '2026-03-14T03:00:00.000Z',
      lineUserId: 'u1',
      selectedCandidateKind: 'city_pack_backed_candidate',
      knowledgeCandidateCountBySource: { faq: 1, savedFaq: 0, cityPack: 1, sourceRefs: 2, webSearch: 0 },
      knowledgeCandidateUsed: true,
      cityPackCandidateAvailable: true,
      cityPackUsedInAnswer: true,
      cityPackRejectedReason: 'none',
      savedFaqCandidateAvailable: false,
      savedFaqRejectedReason: 'saved_faq_intent_mismatch',
      knowledgeCandidateRejectedReason: 'none',
      knowledgeGroundingKind: 'city_pack',
      sourceReadinessDecisionSource: 'selected_knowledge_candidate'
    },
    {
      createdAt: '2026-03-14T03:01:00.000Z',
      lineUserId: 'u2',
      selectedCandidateKind: 'saved_faq_candidate',
      knowledgeCandidateCountBySource: { faq: 1, savedFaq: 1, cityPack: 0, sourceRefs: 1, webSearch: 0 },
      knowledgeCandidateUsed: true,
      cityPackCandidateAvailable: false,
      cityPackUsedInAnswer: false,
      cityPackRejectedReason: 'no_city_pack_match',
      savedFaqCandidateAvailable: true,
      savedFaqUsedInAnswer: true,
      savedFaqRejectedReason: 'none',
      knowledgeCandidateRejectedReason: 'faq_clarify',
      knowledgeGroundingKind: 'saved_faq',
      sourceReadinessDecisionSource: 'selected_knowledge_candidate'
    }
  ]);

  assert.equal(summary.knowledgeActivationRate, 1);
  assert.equal(summary.cityPackCandidateActivationRate, 0.5);
  assert.equal(summary.savedFaqCandidateActivationRate, 0.5);
  assert.ok(summary.knowledgeRejectedReasons.some((row) => row.knowledgeCandidateRejectedReason === 'faq_clarify'));
  assert.ok(summary.cityPackRejectedReasons.some((row) => row.cityPackRejectedReason === 'no_city_pack_match'));
  assert.ok(summary.savedFaqRejectedReasons.some((row) => row.savedFaqRejectedReason === 'saved_faq_intent_mismatch'));
  assert.ok(summary.knowledgeGroundingKinds.some((row) => row.knowledgeGroundingKind === 'city_pack'));

  const trace = buildTraceJoinSummary({
    audits: [{ action: 'llm_gate.decision' }],
    decisions: [{ traceId: 'trace-knowledge' }],
    timeline: [{ traceId: 'trace-knowledge' }],
    llmActions: [{
      traceId: 'trace-knowledge',
      entryType: 'webhook',
      routeKind: 'canonical',
      conversationMode: 'concierge',
      knowledgeCandidateRejectedReason: 'faq_clarify',
      cityPackRejectedReason: 'no_city_pack_match',
      savedFaqRejectedReason: 'saved_faq_intent_mismatch',
      knowledgeGroundingKind: 'saved_faq',
      sourceReadinessDecisionSource: 'selected_knowledge_candidate'
    }],
    sourceEvidence: [],
    faqAnswerLogs: [],
    emergencyEvents: [],
    emergencyBulletins: [],
    cityPackBulletins: [],
    taskEvents: [],
    journeyBranchQueue: []
  });

  assert.ok(trace.routeHints.knowledgeRejectedReasons.includes('faq_clarify'));
  assert.ok(trace.routeHints.cityPackRejectedReasons.includes('no_city_pack_match'));
  assert.ok(trace.routeHints.savedFaqRejectedReasons.includes('saved_faq_intent_mismatch'));
  assert.ok(trace.routeHints.knowledgeGroundingKinds.includes('saved_faq'));
  assert.ok(trace.routeHints.sourceReadinessDecisionSources.includes('selected_knowledge_candidate'));
});
