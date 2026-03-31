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

test('phase835: school runtime knowledge rejects generic faq intent mismatch and keeps telemetry visible', async () => {
  const result = await buildRuntimeKnowledgeCandidates({
    packet: {
      lineUserId: 'u_phase835_school',
      messageText: '学校の途中編入で、district がまだ決まってない。今日やることを1つだけ教えて。',
      normalizedConversationIntent: 'school',
      paidIntent: 'situation_analysis',
      genericFallbackSlice: 'other',
      requestContract: {
        requestShape: 'answer',
        locationHint: { kind: 'none' }
      }
    },
    locale: 'ja',
    intentRiskTier: 'low'
  }, {
    searchFaqFromKb: async () => ({ ok: true, candidates: [{ articleId: 'faq-school-bad' }] }),
    getFaqArticle: async () => ({
      id: 'faq-school-bad',
      title: '着任後1か月の生活立ち上げ優先順位',
      body: '最初の1か月は身分証、住居、金融、通信、医療導線の5領域を優先する。未完了タスクは期限と依存関係を明示し、週次でリスクを再評価する。',
      sourceSnapshotRefs: ['src-official-1'],
      linkRegistryIds: ['link-official-1'],
      allowedIntents: ['GENERAL', 'FAQ'],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      authorityLevel: 'state',
      authorityTier: 'T2_PUBLIC_DATA',
      bindingLevel: 'REFERENCE',
      riskLevel: 'low',
      status: 'active'
    }),
    searchCityPackCandidates: async () => ({ ok: true, mode: 'empty', candidates: [], regionKey: null }),
    listCityPacks: async () => []
  });

  assert.equal(result.candidates.length, 0);
  assert.equal(result.telemetry.knowledgeCandidateRejectedReason, 'faq_intent_mismatch');
  assert.ok(result.telemetry.knowledgeRejectedReasons.includes('faq_intent_mismatch'));
  assert.equal(result.telemetry.savedFaqRejectedReason, 'saved_faq_intent_mismatch');
});
