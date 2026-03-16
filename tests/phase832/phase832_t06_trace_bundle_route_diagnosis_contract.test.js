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
      contractVersion: 'sro_v2',
      pathType: 'slow',
      serviceSurface: 'quick_reply',
      groupPrivacyMode: 'group_safe',
      handoffState: 'OFFERED',
      uUnits: ['U-16', 'U-17', 'U-27'],
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
  assert.ok(summary.routeHints.contractVersions.includes('sro_v2'));
  assert.ok(summary.routeHints.pathTypes.includes('slow'));
  assert.ok(summary.routeHints.serviceSurfaces.includes('quick_reply'));
  assert.ok(summary.routeHints.groupPrivacyModes.includes('group_safe'));
  assert.ok(summary.routeHints.handoffStates.includes('OFFERED'));
  assert.ok(summary.routeHints.uUnits.includes('U-27'));
});
