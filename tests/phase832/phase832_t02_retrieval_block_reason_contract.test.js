'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationQualitySummary } = require('../../src/routes/admin/osLlmUsageSummary');

test('phase832: summary keeps retrieval block reasons separate from retrieval quality', () => {
  const summary = buildConversationQualitySummary([
    {
      createdAt: '2026-03-13T10:00:00.000Z',
      lineUserId: 'u1',
      conversationMode: 'concierge',
      strategy: 'domain_concierge',
      strategyReason: 'explicit_domain_intent',
      retrieveNeeded: false,
      retrievalBlockedByStrategy: true,
      retrievalBlockReason: 'strategy_domain_concierge',
      retrievalQuality: 'none',
      selectedCandidateKind: 'domain_concierge_candidate',
      genericFallbackSlice: 'housing'
    },
    {
      createdAt: '2026-03-13T10:01:00.000Z',
      lineUserId: 'u2',
      conversationMode: 'casual',
      strategy: 'clarify',
      strategyReason: 'broad_question_clarify',
      retrieveNeeded: false,
      retrievalBlockedByStrategy: true,
      retrievalBlockReason: 'strategy_clarify',
      retrievalQuality: 'none',
      selectedCandidateKind: 'clarify_candidate',
      genericFallbackSlice: 'broad'
    }
  ]);

  const reasons = Object.fromEntries(summary.retrievalBlockReasons.map((row) => [row.retrievalBlockReason, row.count]));
  assert.equal(summary.retrievalBlockedByStrategyRate, 1);
  assert.equal(reasons.strategy_domain_concierge, 1);
  assert.equal(reasons.strategy_clarify, 1);
});
