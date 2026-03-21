'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { buildConversationQualitySummary } = require('../../src/routes/admin/osLlmUsageSummary');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase719: conversation quality summary aggregates naturalness and domain concierge rate', () => {
  const summary = buildConversationQualitySummary([
    {
      legacyTemplateHit: false,
      followupQuestionIncluded: true,
      pitfallIncluded: true,
      actionCount: 3,
      domainIntent: 'housing',
      conversationMode: 'concierge',
      fallbackType: 'domain_concierge',
      routeKind: 'canonical',
      routerReason: 'housing_intent_detected',
      routerReasonObserved: true,
      sharedReadinessBridge: 'webhook_direct_readiness',
      sharedReadinessBridgeObserved: true,
      routeDecisionSource: 'conversation_router',
      entryType: 'webhook',
      requestShape: 'compare',
      outputForm: 'default',
      detailObligations: ['preserve_reason', 'preserve_order_axis'],
      answerability: 'answer_now',
      echoOfPriorAssistant: false,
      violationCodes: []
    },
    {
      legacyTemplateHit: false,
      followupQuestionIncluded: false,
      pitfallIncluded: true,
      actionCount: 2,
      domainIntent: 'school',
      conversationMode: 'concierge',
      fallbackType: 'domain_concierge_fallback',
      routeKind: 'compat',
      routerReason: 'school_intent_detected',
      routerReasonObserved: true,
      compatFallbackReason: 'legacy_compat_ops_explain',
      sharedReadinessBridge: 'shared_compat_ops_explain',
      sharedReadinessBridgeObserved: true,
      routeDecisionSource: 'compat_route',
      entryType: 'compat',
      requestShape: 'correction',
      outputForm: 'one_line',
      detailObligations: ['respect_correction', 'preserve_reason'],
      answerability: 'answer_now',
      echoOfPriorAssistant: false,
      violationCodes: ['correction_ignored', 'format_noncompliance']
    },
    {
      legacyTemplateHit: true,
      followupQuestionIncluded: false,
      pitfallIncluded: false,
      actionCount: 0,
      domainIntent: 'general',
      conversationMode: 'casual',
      fallbackType: 'free_retrieval_sanitized',
      routeKind: 'canonical',
      routerReasonObserved: false,
      sharedReadinessBridgeObserved: false,
      routeDecisionSource: 'webhook_route',
      entryType: 'webhook',
      requestShape: 'message_template',
      outputForm: 'message_only',
      detailObligations: ['preserve_both_domains', 'message_only'],
      answerability: 'answer_now',
      echoOfPriorAssistant: true,
      violationCodes: ['detail_drop', 'mixed_domain_collapse', 'followup_overask', 'internal_label_leak', 'parrot_echo', 'command_boundary_collision']
    }
  ]);

  assert.equal(summary.sampleCount, 3);
  assert.equal(summary.conversationNaturalnessVersion, 'v1');
  assert.equal(summary.legacyTemplateHitRate, 0.3333);
  assert.equal(summary.followupQuestionIncludedRate, 0.3333);
  assert.equal(summary.pitfallIncludedRate, 0.6667);
  assert.equal(summary.avgActionCount, 1.6667);
  assert.equal(summary.domainIntentConciergeRate, 1);
  assert.equal(summary.formatComplianceRate, 0.6667);
  assert.equal(summary.detailCarryRate, 0.3333);
  assert.equal(summary.correctionRecoveryRate, 0);
  assert.equal(summary.mixedDomainRetentionRate, 0);
  assert.equal(summary.followupOveraskRate, 0.3333);
  assert.equal(summary.internalLabelLeakRate, 0.3333);
  assert.equal(summary.parrotEchoRate, 0.3333);
  assert.equal(summary.commandBoundaryCollisionRate, 0.3333);
  assert.equal(summary.routerReasonObservedRate, 0.6667);
  assert.equal(summary.sharedReadinessBridgeObservedRate, 0.6667);
  assert.equal(summary.routeAttributionCompleteness, 1);
  assert.ok(Array.isArray(summary.domainIntents));
  assert.ok(Array.isArray(summary.requestShapes));
  assert.ok(Array.isArray(summary.outputForms));
  assert.ok(Array.isArray(summary.violationCodeCounts));
  assert.ok(Array.isArray(summary.fallbackTypes));
  assert.ok(Array.isArray(summary.routeKinds));
  assert.ok(Array.isArray(summary.compatFallbackReasons));
  assert.ok(Array.isArray(summary.sharedReadinessBridges));
  assert.ok(Array.isArray(summary.routeDecisionSources));
  assert.equal(summary.requestShapes.some((item) => item.requestShape === 'correction' && item.count === 1), true);
  assert.equal(summary.outputForms.some((item) => item.outputForm === 'message_only' && item.count === 1), true);
  assert.equal(summary.violationCodeCounts.some((item) => item.violationCode === 'internal_label_leak' && item.count === 1), true);
});

test('phase719: llm action log schema includes conversation quality metadata fields', () => {
  const repo = read('src/repos/firestore/llmActionLogsRepo.js');
  [
    'conversationNaturalnessVersion',
    'legacyTemplateHit',
    'followupQuestionIncluded',
    'actionCount',
    'pitfallIncluded',
    'domainIntent',
    'fallbackType',
    'interventionSuppressedBy',
    'routeKind',
    'routerReasonObserved',
    'compatFallbackReason',
    'sharedReadinessBridge',
    'sharedReadinessBridgeObserved',
    'routeDecisionSource',
    'transcriptSnapshotOutcome',
    'transcriptSnapshotReason',
    'transcriptSnapshotAssistantReplyPresent',
    'transcriptSnapshotAssistantReplyLength',
    'transcriptSnapshotSanitizedReplyLength',
    'transcriptSnapshotBuildAttempted',
    'transcriptSnapshotBuildSkippedReason',
    'requestShape',
    'outputForm',
    'detailObligations',
    'answerability',
    'echoOfPriorAssistant',
    'violationCodes'
  ].forEach((token) => {
    assert.ok(repo.includes(token), token);
  });

  const usageSummary = read('src/routes/admin/osLlmUsageSummary.js');
  assert.ok(usageSummary.includes('buildConversationQualitySummary'));
  assert.ok(usageSummary.includes('conversationQuality'));
  assert.ok(usageSummary.includes('formatComplianceRate'));
  assert.ok(usageSummary.includes('violationCodeCounts'));
});
