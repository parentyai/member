'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildRuntimeKnowledgeCandidates } = require('../../src/domain/llm/knowledge/buildRuntimeKnowledgeCandidates');
const { buildConversationQualitySummary } = require('../../src/routes/admin/osLlmUsageSummary');
const { buildTraceJoinSummary } = require('../../src/usecases/admin/getTraceBundle');

test('phase835: knowledge rejected reasons remain visible in summary and trace telemetry', async () => {
  const result = await buildRuntimeKnowledgeCandidates({
    packet: {
      lineUserId: 'u_phase835_rejects',
      messageText: '住まい探しって何から始めればいいですか？',
      normalizedConversationIntent: 'housing',
      genericFallbackSlice: 'housing'
    },
    locale: 'ja',
    intentRiskTier: 'low'
  }, {
    searchFaqFromKb: async () => ({ ok: true, candidates: [] }),
    searchCityPackCandidates: async () => ({ ok: true, mode: 'empty', candidates: [], regionKey: null }),
    listCityPacks: async () => []
  });

  assert.ok(Array.isArray(result.telemetry.knowledgeRejectedReasons));
  assert.ok(result.telemetry.knowledgeRejectedReasons.includes('no_faq_match'));

  const summary = buildConversationQualitySummary([{
    createdAt: '2026-03-14T04:00:00.000Z',
    lineUserId: 'u_phase835_rejects',
    knowledgeRejectedReasons: result.telemetry.knowledgeRejectedReasons,
    knowledgeCandidateRejectedReason: result.telemetry.knowledgeCandidateRejectedReason,
    cityPackRejectedReason: result.telemetry.cityPackRejectedReason,
    savedFaqRejectedReason: result.telemetry.savedFaqRejectedReason
  }]);

  assert.ok(summary.knowledgeRejectedReasons.some((row) => row.knowledgeCandidateRejectedReason === 'no_faq_match'));

  const trace = buildTraceJoinSummary({
    audits: [{ action: 'llm_gate.decision' }],
    decisions: [{ traceId: 'trace-phase835' }],
    timeline: [{ traceId: 'trace-phase835' }],
    llmActions: [{
      traceId: 'trace-phase835',
      knowledgeRejectedReasons: result.telemetry.knowledgeRejectedReasons,
      knowledgeCandidateRejectedReason: result.telemetry.knowledgeCandidateRejectedReason
    }],
    sourceEvidence: [],
    faqAnswerLogs: [],
    emergencyEvents: [],
    emergencyBulletins: [],
    cityPackBulletins: [],
    taskEvents: [],
    journeyBranchQueue: []
  });

  assert.ok(trace.routeHints.knowledgeRejectedReasons.includes('no_faq_match'));
});
