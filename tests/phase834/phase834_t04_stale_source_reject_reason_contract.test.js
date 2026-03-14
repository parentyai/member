'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationPacket } = require('../../src/domain/llm/orchestrator/buildConversationPacket');
const { buildRuntimeKnowledgeCandidates } = require('../../src/domain/llm/knowledge/buildRuntimeKnowledgeCandidates');
const { baseFlags, makeFaqArticle, pastIso, makeSearchFaqDeps } = require('./_helpers');

test('phase834: stale knowledge source is rejected with an explainable reason', async () => {
  const article = makeFaqArticle({
    validUntil: pastIso(7),
    sourceSnapshotRefs: [],
    linkRegistryIds: []
  });
  const packet = buildConversationPacket({
    lineUserId: 'u_phase834_stale',
    messageText: '赴任準備で最初に何を確認すべきですか？',
    paidIntent: 'situation_analysis',
    planInfo: { plan: 'pro', status: 'active' },
    llmFlags: baseFlags
  });
  const result = await buildRuntimeKnowledgeCandidates({
    packet,
    locale: 'ja',
    intentRiskTier: 'low'
  }, makeSearchFaqDeps(article));

  assert.equal(result.candidates.some((candidate) => candidate.kind === 'knowledge_backed_candidate'), false);
  assert.ok(/^faq_(clarify|hedged|refuse)$/.test(result.telemetry.knowledgeCandidateRejectedReason));
  assert.equal(result.telemetry.savedFaqCandidateAvailable, true);
  assert.equal(result.telemetry.savedFaqRejectedReason, 'saved_faq_stale');
});
