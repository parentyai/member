'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');
const {
  baseFlags,
  buildPlanInfo,
  makeBlockedGroundedReply,
  makeDomainCandidate,
  makeOfficialSourceRef
} = require('./_helpers');

test('phase834: city question activates city pack candidate before generic concierge', async () => {
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'u_phase834_city',
    messageText: 'ニューヨークに引っ越す予定なんですが、生活で最初に困ることって何ですか？',
    paidIntent: 'situation_analysis',
    planInfo: buildPlanInfo(),
    llmFlags: baseFlags,
    deps: {
      generatePaidCasualReply: () => ({ replyText: 'こんにちは。' }),
      generateGroundedReply: makeBlockedGroundedReply('city_grounding_missing'),
      generateDomainConciergeCandidate: async () => makeDomainCandidate('housing'),
      searchFaqFromKb: async () => ({ ok: true, candidates: [] }),
      searchCityPackCandidates: async () => ({ ok: true, mode: 'empty', candidates: [], regionKey: null }),
      listCityPacks: async () => ([{
        cityPackId: 'cp_nyc',
        name: 'ニューヨーク生活立ち上げガイド',
        regionKey: 'new-york',
        regionCity: 'ニューヨーク',
        sourceRefs: ['src-ny-1'],
        status: 'active'
      }]),
      getSourceRef: async () => makeOfficialSourceRef({ id: 'src-ny-1' })
    }
  });

  assert.equal(result.packet.genericFallbackSlice, 'city');
  assert.equal(result.telemetry.retrievalBlockedByStrategy, false);
  assert.equal(result.telemetry.cityPackCandidateAvailable, true);
  assert.equal(result.telemetry.cityPackRejectedReason, null);
  assert.equal(result.telemetry.selectedCandidateKind, 'city_pack_backed_candidate');
  assert.equal(result.telemetry.cityPackUsedInAnswer, true);
  assert.equal(result.telemetry.knowledgeGroundingKind, 'city_pack');
  assert.equal(result.telemetry.sourceReadinessDecisionSource, 'selected_knowledge_candidate');
});
