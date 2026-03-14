'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildTraceJoinSummary } = require('../../src/usecases/admin/getTraceBundle');

test('phase832: trace bundle route hints expose diagnosis fields for fallback collapse', () => {
  const summary = buildTraceJoinSummary({
    audits: [{ action: 'llm_gate.decision' }],
    decisions: [{ traceId: 'trace-1' }],
    timeline: [{ traceId: 'trace-1' }],
    llmActions: [{
      traceId: 'trace-1',
      entryType: 'webhook',
      routeKind: 'canonical',
      conversationMode: 'concierge',
      routerReason: 'question_pattern',
      strategyReason: 'broad_question_clarify',
      selectedCandidateKind: 'clarify_candidate',
      retrievalBlockReason: 'strategy_clarify',
      fallbackType: 'low_specificity_clarify',
      fallbackTemplateKind: 'generic_fallback',
      finalizerTemplateKind: 'generic_fallback',
      replyTemplateFingerprint: 'rtf_same',
      genericFallbackSlice: 'broad',
      sharedReadinessBridge: 'webhook_direct_readiness',
      routeDecisionSource: 'conversation_router'
    }],
    sourceEvidence: [],
    faqAnswerLogs: [],
    emergencyEvents: [],
    emergencyBulletins: [],
    cityPackBulletins: [],
    taskEvents: [],
    journeyBranchQueue: []
  });

  assert.ok(summary.routeHints.strategyReasons.includes('broad_question_clarify'));
  assert.ok(summary.routeHints.selectedCandidateKinds.includes('clarify_candidate'));
  assert.ok(summary.routeHints.retrievalBlockReasons.includes('strategy_clarify'));
  assert.ok(summary.routeHints.fallbackTemplateKinds.includes('generic_fallback'));
  assert.ok(summary.routeHints.finalizerTemplateKinds.includes('generic_fallback'));
  assert.ok(summary.routeHints.replyTemplateFingerprints.includes('rtf_same'));
  assert.ok(summary.routeHints.genericFallbackSlices.includes('broad'));
});
