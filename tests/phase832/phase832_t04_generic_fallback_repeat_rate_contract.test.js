'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationQualitySummary } = require('../../src/routes/admin/osLlmUsageSummary');
const { buildRuntimeAuditReport } = require('../../tools/run_llm_runtime_audit');

test('phase832: runtime audit exposes generic fallback repeat rate and repeated fingerprints', () => {
  const actionRows = [
    {
      createdAt: '2026-03-13T10:00:00.000Z',
      lineUserId: 'u1',
      conversationMode: 'concierge',
      strategy: 'clarify',
      strategyReason: 'broad_question_clarify',
      fallbackTemplateKind: 'generic_fallback',
      finalizerTemplateKind: 'generic_fallback',
      replyTemplateFingerprint: 'rtf_same',
      genericFallbackSlice: 'broad'
    },
    {
      createdAt: '2026-03-13T10:01:00.000Z',
      lineUserId: 'u1',
      conversationMode: 'concierge',
      strategy: 'clarify',
      strategyReason: 'broad_question_clarify',
      fallbackTemplateKind: 'generic_fallback',
      finalizerTemplateKind: 'generic_fallback',
      replyTemplateFingerprint: 'rtf_same',
      genericFallbackSlice: 'broad'
    },
    {
      createdAt: '2026-03-13T10:02:00.000Z',
      lineUserId: 'u2',
      conversationMode: 'concierge',
      strategy: 'domain_concierge',
      strategyReason: 'explicit_domain_intent',
      fallbackTemplateKind: 'domain_concierge_template',
      finalizerTemplateKind: 'domain_concierge_template',
      replyTemplateFingerprint: 'rtf_other',
      genericFallbackSlice: 'housing'
    }
  ];

  const summary = buildConversationQualitySummary(actionRows);
  assert.equal(summary.genericFallbackSliceSampleCount, 3);
  assert.equal(summary.genericFallbackRepeatRate, 0.3333);
  assert.equal(summary.topRepeatedFallbackFingerprints[0].replyTemplateFingerprint, 'rtf_same');

  const report = buildRuntimeAuditReport({
    fromAt: '2026-03-13T10:00:00.000Z',
    toAt: '2026-03-13T10:03:00.000Z',
    limit: 10,
    gateAuditRows: [],
    actionRows,
    qualityRows: [],
    faqRows: [],
    traceSearchAuditRows: [],
    traceProbeRows: [],
    runtimeFetchStatus: 'ok'
  });

  assert.equal(report.kpis.genericFallbackRepeatRate.status, 'fail');
  assert.equal(report.kpis.genericFallbackRepeatRate.value, 0.3333);
  assert.equal(report.routeCoverage.genericFallbackRepeatRateBySlice[0].genericFallbackSlice, 'broad');
  assert.equal(report.routeCoverage.topRepeatedFallbackFingerprints[0].replyTemplateFingerprint, 'rtf_same');
});
