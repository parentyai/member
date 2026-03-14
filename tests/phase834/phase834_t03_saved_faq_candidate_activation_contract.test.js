'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationPacket } = require('../../src/domain/llm/orchestrator/buildConversationPacket');
const { buildRuntimeKnowledgeCandidates } = require('../../src/domain/llm/knowledge/buildRuntimeKnowledgeCandidates');
const { baseFlags, makeFaqArticle, makeSearchFaqDeps } = require('./_helpers');

test('phase834: valid saved faq becomes an explicit runtime candidate', async () => {
  const article = makeFaqArticle({
    allowedIntents: ['GENERAL', 'HOUSING'],
    sourceSnapshotRefs: ['src-official-1'],
    linkRegistryIds: ['link-official-1']
  });
  const packet = buildConversationPacket({
    lineUserId: 'u_phase834_savedfaq',
    messageText: '住まい探しで最初に確認することを教えてください。',
    paidIntent: 'situation_analysis',
    planInfo: { plan: 'pro', status: 'active' },
    llmFlags: baseFlags
  });
  const result = await buildRuntimeKnowledgeCandidates({
    packet,
    locale: 'ja',
    intentRiskTier: 'low'
  }, makeSearchFaqDeps(article));

  assert.equal(result.telemetry.savedFaqCandidateAvailable, true);
  assert.equal(result.telemetry.savedFaqRejectedReason, null);
  assert.ok(result.candidates.some((candidate) => candidate.kind === 'saved_faq_candidate'));
  assert.ok(result.candidates.some((candidate) => candidate.savedFaqReused === true));
});
