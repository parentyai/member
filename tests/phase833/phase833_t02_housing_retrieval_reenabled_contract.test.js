'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');

test('phase833: housing question re-enables retrieval and avoids domain concierge first choice', async () => {
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'u_phase833_housing',
    messageText: '住まい探しって最初に何を見るべきですか？',
    paidIntent: 'situation_analysis',
    planInfo: { plan: 'pro', status: 'active' },
    llmFlags: {
      llmConciergeEnabled: true,
      llmWebSearchEnabled: true,
      llmStyleEngineEnabled: true,
      llmBanditEnabled: false,
      qualityEnabled: true,
      snapshotStrictMode: false
    },
    deps: {
      generatePaidCasualReply: () => ({ replyText: 'こんにちは。' }),
      generateGroundedReply: async () => ({
        ok: true,
        replyText: '住まい探しでは、候補条件を先に3つまで絞ると進めやすいです。',
        output: {
          situation: '住まい探しの整理です。',
          nextActions: ['希望エリアを決める', '予算帯を決める'],
          risks: ['条件が広すぎると内見調整が止まりやすいです。'],
          gaps: ['入居時期は決まっていますか？']
        },
        assistantQuality: {
          intentResolved: 'situation_analysis',
          kbTopScore: 0.9,
          evidenceCoverage: 0.88,
          blockedStage: null,
          fallbackReason: null
        },
        top1Score: 0.9
      }),
      generateDomainConciergeCandidate: async () => ({
        ok: true,
        replyText: '状況を整理しながら進めます。まずは優先する手続きを1つ決めましょう。',
        domainIntent: 'housing',
        conversationMode: 'concierge',
        opportunityType: 'action',
        opportunityReasonKeys: ['housing_intent'],
        interventionBudget: 1,
        auditMeta: null
      })
    }
  });

  assert.equal(result.packet.genericFallbackSlice, 'housing');
  assert.equal(result.telemetry.strategy, 'grounded_answer');
  assert.equal(result.telemetry.retrieveNeeded, true);
  assert.match(result.telemetry.retrievalPermitReason || '', /housing_grounding_probe/);
  assert.match(result.telemetry.retrievalPermitReason || '', /explicit_domain_grounding_probe/);
  assert.equal(result.telemetry.groundedCandidateAvailable, true);
  assert.notEqual(result.telemetry.selectedCandidateKind, 'domain_concierge_candidate');
});
