'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveCandidatePriority } = require('../../src/domain/llm/orchestrator/candidatePriority');

test('phase835: followup history prefers continuation, then knowledge, then concierge fallbacks', () => {
  const packet = {
    normalizedConversationIntent: 'housing',
    genericFallbackSlice: 'housing',
    priorContextUsed: true,
    followupResolvedFromHistory: true
  };

  const cityPack = resolveCandidatePriority(packet, { kind: 'city_pack_backed_candidate' });
  const savedFaq = resolveCandidatePriority(packet, { kind: 'saved_faq_candidate' });
  const knowledge = resolveCandidatePriority(packet, { kind: 'knowledge_backed_candidate' });
  const continuation = resolveCandidatePriority(packet, { kind: 'continuation_candidate' });
  const concierge = resolveCandidatePriority(packet, { kind: 'domain_concierge_candidate' });
  const clarify = resolveCandidatePriority(packet, { kind: 'clarify_candidate' });

  assert.ok(cityPack > savedFaq);
  assert.ok(continuation > knowledge);
  assert.ok(knowledge > savedFaq);
  assert.ok(continuation > concierge);
  assert.ok(concierge > clarify);
});
