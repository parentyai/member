'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationQualitySummary } = require('../../src/routes/admin/osLlmUsageSummary');
const { buildRuntimeAuditReport } = require('../../tools/run_llm_runtime_audit');

test('phase833: summary and runtime audit surface selection away from generic fallback first choice', () => {
  const actionRows = [
    {
      createdAt: '2026-03-13T10:00:00.000Z',
      lineUserId: 'u1',
      conversationMode: 'concierge',
      strategy: 'grounded_answer',
      strategyReason: 'broad_question_grounding_probe',
      strategyAlternativeSet: ['grounded_answer', 'structured_answer', 'domain_concierge', 'clarify'],
      strategyPriorityVersion: 'v2',
      fallbackPriorityReason: 'prefer_grounded_over_domain_concierge',
      selectedCandidateKind: 'grounded_candidate',
      retrievalBlockedByStrategy: false,
      retrievalPermitReason: 'broad_structured_grounding_probe',
      retrievalReenabledBySlice: 'broad',
      groundedCandidateAvailable: true,
      structuredCandidateAvailable: true,
      continuationCandidateAvailable: false,
      genericFallbackSlice: 'broad',
      fallbackTemplateKind: 'grounded_answer_template',
      finalizerTemplateKind: 'grounded_answer_template',
      replyTemplateFingerprint: 'rtf_broad'
    },
    {
      createdAt: '2026-03-13T10:01:00.000Z',
      lineUserId: 'u2',
      conversationMode: 'concierge',
      strategy: 'grounded_answer',
      strategyReason: 'followup_grounding_first',
      strategyAlternativeSet: ['continuation', 'grounded_answer', 'domain_concierge', 'clarify'],
      strategyPriorityVersion: 'v2',
      fallbackPriorityReason: 'prefer_continuation_from_history',
      selectedCandidateKind: 'continuation_candidate',
      retrievalBlockedByStrategy: false,
      retrievalPermitReason: 'followup_context_grounding_probe',
      retrievalReenabledBySlice: 'followup',
      groundedCandidateAvailable: true,
      structuredCandidateAvailable: true,
      continuationCandidateAvailable: true,
      genericFallbackSlice: 'followup',
      fallbackTemplateKind: 'grounded_answer_template',
      finalizerTemplateKind: 'grounded_answer_template',
      replyTemplateFingerprint: 'rtf_followup'
    }
  ];

  const summary = buildConversationQualitySummary(actionRows);
  assert.equal(summary.groundedCandidateSelectionRate, 0.5);
  assert.equal(summary.clarifySelectionRate, 0);
  assert.equal(summary.domainConciergeSelectionRate, 0);
  assert.equal(summary.retrievalReenabledRateBySlice.find((row) => row.genericFallbackSlice === 'broad').rate, 1);
  assert.equal(summary.retrievalReenabledRateBySlice.find((row) => row.genericFallbackSlice === 'followup').rate, 1);

  const report = buildRuntimeAuditReport({
    fromAt: '2026-03-13T10:00:00.000Z',
    toAt: '2026-03-13T10:02:00.000Z',
    limit: 10,
    gateAuditRows: [],
    actionRows,
    qualityRows: [],
    faqRows: [],
    traceSearchAuditRows: [],
    traceProbeRows: [],
    runtimeFetchStatus: 'ok'
  });

  assert.equal(report.routeCoverage.groundedCandidateSelectionRate, 0.5);
  assert.equal(report.routeCoverage.domainConciergeSelectionRate, 0);
  assert.equal(report.routeCoverage.clarifySelectionRate, 0);
  assert.equal(report.kpis.genericFallbackRepeatRate.status, 'pass');
});
