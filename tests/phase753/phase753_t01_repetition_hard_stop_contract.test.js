'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');
const { generatePaidCasualReply } = require('../../src/usecases/assistant/generatePaidCasualReply');

test('phase753: orchestrator blocks repeated near-identical replies under contextual resume', async () => {
  const repeatedReply = '学校手続きの次は、対象校を1校に絞って必要書類を先に確定するのが最短です。';
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'U_PHASE753',
    planInfo: { plan: 'pro', status: 'active' },
    messageText: 'ヒザ',
    routerMode: 'casual',
    routerReason: 'default_casual',
    explicitPaidIntent: null,
    paidIntent: 'situation_analysis',
    llmFlags: {
      llmConciergeEnabled: true,
      llmWebSearchEnabled: true,
      llmStyleEngineEnabled: true,
      llmBanditEnabled: false,
      qualityEnabled: true,
      snapshotStrictMode: false
    },
    contextSnapshot: {
      phase: 'arrival',
      topOpenTasks: [{ key: 'school_registration', status: 'open' }]
    },
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'school',
        replyText: repeatedReply
      },
      {
        createdAt: new Date(Date.now() - 1000).toISOString(),
        domainIntent: 'school',
        replyText: repeatedReply
      }
    ],
    deps: {
      generatePaidCasualReply,
      generateGroundedReply: async () => ({ ok: false, blockedReason: 'not_used' }),
      generateDomainConciergeCandidate: async () => ({
        ok: true,
        domainIntent: 'school',
        conversationMode: 'concierge',
        opportunityType: 'action',
        opportunityReasonKeys: ['school_intent'],
        interventionBudget: 1,
        followupIntent: null,
        conciseModeApplied: true,
        replyText: repeatedReply,
        atoms: {
          situationLine: repeatedReply,
          nextActions: ['対象校を1校に絞る'],
          pitfall: '',
          followupQuestion: '学年と希望エリアを教えてもらえますか？'
        },
        auditMeta: null
      })
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.telemetry.repetitionPrevented, true);
  assert.equal(result.telemetry.loopBreakApplied, true);
  assert.equal(typeof result.telemetry.repeatRiskScore, 'number');
  assert.equal(result.telemetry.repeatRiskScore >= 0.4, true);
  assert.equal(result.replyText === repeatedReply, false);
});

test('phase753: repeated follow-up stays concise and avoids repeating identical question line', () => {
  const { generatePaidDomainConciergeReply } = require('../../src/usecases/assistant/generatePaidDomainConciergeReply');
  const response = generatePaidDomainConciergeReply({
    domainIntent: 'ssn',
    messageText: '予約するの？',
    followupIntent: 'appointment_needed',
    recentFollowupIntents: ['appointment_needed', 'appointment_needed'],
    recentResponseHints: [
      '窓口は予約が必要な地域もあるので、最寄り窓口の予約要否を先に確認しましょう。',
      '次は最寄り窓口を1つ決めて予約可否を確認しましょう。'
    ]
  });

  assert.equal(response.ok, true);
  const lines = String(response.replyText || '').split('\n').map((line) => line.trim()).filter(Boolean);
  assert.equal(lines.length <= 2, true);
  assert.equal(response.replyText.includes('教えてもらえますか？'), false);
  assert.equal(response.replyText.includes('対象を絞って案内したいので'), false);
});
