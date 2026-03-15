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
      entryType: 'webhook'
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
      entryType: 'compat'
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
      entryType: 'webhook'
    }
  ]);

  assert.equal(summary.sampleCount, 3);
  assert.equal(summary.conversationNaturalnessVersion, 'v1');
  assert.equal(summary.legacyTemplateHitRate, 0.3333);
  assert.equal(summary.followupQuestionIncludedRate, 0.3333);
  assert.equal(summary.pitfallIncludedRate, 0.6667);
  assert.equal(summary.avgActionCount, 1.6667);
  assert.equal(summary.domainIntentConciergeRate, 1);
  assert.equal(summary.routerReasonObservedRate, 0.6667);
  assert.equal(summary.sharedReadinessBridgeObservedRate, 0.6667);
  assert.equal(summary.routeAttributionCompleteness, 1);
  assert.ok(Array.isArray(summary.domainIntents));
  assert.ok(Array.isArray(summary.fallbackTypes));
  assert.ok(Array.isArray(summary.routeKinds));
  assert.ok(Array.isArray(summary.compatFallbackReasons));
  assert.ok(Array.isArray(summary.sharedReadinessBridges));
  assert.ok(Array.isArray(summary.routeDecisionSources));
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
    'transcriptSnapshotBuildSkippedReason'
  ].forEach((token) => {
    assert.ok(repo.includes(token), token);
  });

  const usageSummary = read('src/routes/admin/osLlmUsageSummary.js');
  assert.ok(usageSummary.includes('buildConversationQualitySummary'));
  assert.ok(usageSummary.includes('conversationQuality'));
});
