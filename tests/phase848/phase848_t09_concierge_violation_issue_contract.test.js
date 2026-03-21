'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateConversationQuality } = require('../../src/domain/qualityPatrol/evaluateConversationQuality');

test('phase848: concierge violation telemetry is converted into deterministic issue candidates', () => {
  const result = evaluateConversationQuality({
    reviewUnitId: 'review_unit_concierge_violation_family',
    slice: 'follow-up',
    userMessage: { text: 'それは違う。学校じゃなくて住まい優先で、文面だけ1行で作って。', available: true },
    assistantReply: { text: 'domain_concierge_candidate まず状況整理しましょう。。', available: true },
    priorContextSummary: { text: '学校手続きの説明が続いていた', available: true },
    telemetrySignals: {
      strategyReason: 'followup_support',
      selectedCandidateKind: 'domain_concierge_candidate',
      fallbackTemplateKind: 'generic_fallback',
      finalizerTemplateKind: 'generic_fallback',
      genericFallbackSlice: 'followup',
      priorContextUsed: true,
      followupResolvedFromHistory: false,
      directAnswerApplied: false,
      knowledgeCandidateUsed: false,
      groundedCandidateAvailable: false,
      cityPackCandidateAvailable: false,
      cityPackUsedInAnswer: false,
      savedFaqCandidateAvailable: false,
      savedFaqUsedInAnswer: false,
      replyTemplateFingerprint: 'fp_concierge_violation_family',
      repeatRiskScore: 0.88,
      violationCodes: [
        'detail_drop',
        'correction_ignored',
        'mixed_domain_collapse',
        'followup_overask',
        'internal_label_leak',
        'command_boundary_collision',
        'punctuation_anomaly',
        'parrot_echo'
      ]
    },
    observationBlockers: [],
    evidenceRefs: [],
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  });

  [
    'generic_loop_fixed_reply',
    'detail_format_drop',
    'correction_ignored',
    'mixed_domain_collapse',
    'followup_overask',
    'internal_label_leak',
    'command_boundary_collision',
    'punctuation_anomaly',
    'parrot_echo'
  ].forEach((code) => {
    assert.equal(result.issueCandidates.some((item) => item.code === code), true, code);
  });
});
