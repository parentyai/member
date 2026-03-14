'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { normalizeConversationIntent } = require('../../src/domain/llm/router/normalizeConversationIntent');
const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');

test('phase833: city and relocation wording no longer stays fully general', async () => {
  const messageText = 'ニューヨークに引っ越す予定なんですが、生活で最初に困ることって何ですか？';
  assert.equal(normalizeConversationIntent(messageText), 'housing');

  const result = await runPaidConversationOrchestrator({
    lineUserId: 'u_phase833_city',
    messageText,
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
        replyText: '最初は生活立ち上げで詰まりやすい支出と住居条件を先に整理すると進めやすいです。',
        output: {
          situation: '赴任先の生活立ち上げです。',
          nextActions: ['住居条件を決める', '初期費用を見積もる'],
          risks: ['家賃と初期費用の見落としで手戻りしやすいです。'],
          gaps: ['赴任時期は決まっていますか？']
        },
        assistantQuality: {
          intentResolved: 'situation_analysis',
          kbTopScore: 0.91,
          evidenceCoverage: 0.86,
          blockedStage: null,
          fallbackReason: null
        },
        top1Score: 0.91
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

  assert.equal(result.packet.normalizedConversationIntent, 'housing');
  assert.equal(result.packet.genericFallbackSlice, 'city');
  assert.equal(result.telemetry.selectedCandidateKind, 'city_grounded_candidate');
  assert.match(String(result.telemetry.retrievalPermitReason), /city_grounding_probe/);
});
