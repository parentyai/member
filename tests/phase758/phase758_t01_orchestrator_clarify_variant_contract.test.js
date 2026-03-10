'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');

test('phase758: clarify candidate avoids repeating recent generic clarification phrase', async () => {
  const repeatedPhrase = '対象を絞って案内したいので、いま一番気になっている手続きと期限を1つずつ教えてください。';
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'U_PHASE758_REPEAT',
    messageText: '何から始めればいい？',
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
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'general',
        replyText: repeatedPhrase
      }
    ],
    deps: {
      generatePaidCasualReply: () => ({ replyText: 'こんにちは。' }),
      generateGroundedReply: async () => ({ ok: false, blockedReason: 'not_used' }),
      generateDomainConciergeCandidate: async () => ({ ok: false, blockedReason: 'not_used' })
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.telemetry.strategy, 'clarify');
  assert.equal(result.replyText.includes(repeatedPhrase), false);
  assert.equal(result.replyText.includes('まず優先手続きを1つに絞りたい'), true);
});

test('phase758: domain follow-up clarify remains domain-specific when domain candidate is unavailable', async () => {
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'U_PHASE758_SSN',
    messageText: 'SSN 予約するの？',
    paidIntent: 'situation_analysis',
    planInfo: { plan: 'pro', status: 'active' },
    routerMode: 'casual',
    routerReason: 'default_casual',
    llmFlags: {
      llmConciergeEnabled: true,
      llmWebSearchEnabled: true,
      llmStyleEngineEnabled: true,
      llmBanditEnabled: false,
      qualityEnabled: true,
      snapshotStrictMode: false
    },
    contextSnapshot: {
      topOpenTasks: [{ key: 'ssn_application', status: 'open' }]
    },
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'ssn',
        followupIntent: 'docs_required'
      }
    ],
    deps: {
      generatePaidCasualReply: () => ({ replyText: '了解です。' }),
      generateGroundedReply: async () => ({ ok: false, blockedReason: 'not_used' }),
      generateDomainConciergeCandidate: async () => ({ ok: false, blockedReason: 'not_used' })
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.packet.normalizedConversationIntent, 'ssn');
  assert.equal(result.packet.followupIntent, 'appointment_needed');
  assert.match(result.replyText, /SSN|窓口/);
  assert.equal(result.telemetry.directAnswerApplied, false);
  assert.equal(result.telemetry.followupIntent, 'appointment_needed');
});
