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

test('phase835: city-scoped direct answer prefers concierge over generic faq and knowledge when exact city grounding is unavailable', () => {
  const packet = {
    normalizedConversationIntent: 'school',
    requestShape: 'answer',
    knowledgeScope: 'city',
    locationHint: {
      kind: 'city',
      cityKey: 'new-york'
    }
  };

  const cityPack = resolveCandidatePriority(packet, { kind: 'city_pack_backed_candidate' });
  const cityGrounded = resolveCandidatePriority(packet, { kind: 'city_grounded_candidate' });
  const savedFaq = resolveCandidatePriority(packet, { kind: 'saved_faq_candidate' });
  const knowledge = resolveCandidatePriority(packet, { kind: 'knowledge_backed_candidate' });
  const concierge = resolveCandidatePriority(packet, { kind: 'domain_concierge_candidate' });

  assert.ok(cityPack > cityGrounded);
  assert.ok(cityGrounded > concierge);
  assert.ok(concierge > savedFaq);
  assert.ok(concierge > knowledge);
});

test('phase835: state-scoped direct answer still prefers concierge over generic faq and knowledge', () => {
  const packet = {
    normalizedConversationIntent: 'school',
    requestShape: 'answer',
    locationHint: {
      kind: 'state',
      state: 'NY'
    }
  };

  const savedFaq = resolveCandidatePriority(packet, { kind: 'saved_faq_candidate' });
  const knowledge = resolveCandidatePriority(packet, { kind: 'knowledge_backed_candidate' });
  const concierge = resolveCandidatePriority(packet, { kind: 'domain_concierge_candidate' });

  assert.ok(concierge > savedFaq);
  assert.ok(concierge > knowledge);
});
