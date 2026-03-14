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
  assert.equal(result.telemetry.strategy, 'grounded_answer');
  assert.equal(result.telemetry.strategyReason, 'broad_question_grounding_probe');
  assert.ok(
    ['knowledge_backed_candidate', 'clarify_candidate'].includes(result.telemetry.selectedCandidateKind),
    `unexpected selectedCandidateKind: ${result.telemetry.selectedCandidateKind}`
  );
  assert.equal(result.telemetry.retrieveNeeded, true);
  assert.equal(result.telemetry.retrievalBlockedByStrategy, false);
  assert.equal(result.telemetry.retrievalPermitReason, 'broad_structured_grounding_probe');
  if (result.telemetry.selectedCandidateKind === 'knowledge_backed_candidate') {
    assert.equal(result.telemetry.knowledgeCandidateUsed, true);
  }
  assert.equal(result.replyText.includes(repeatedPhrase), false);
  assert.ok(typeof result.replyText === 'string' && result.replyText.trim().length > 0);
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
  assert.equal(result.telemetry.directAnswerApplied, true);
  assert.equal(result.telemetry.followupIntent, 'appointment_needed');
});

test('phase758: recovery signal preserves domain context before high-risk safety refusal', async () => {
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'U_PHASE758_RECOVERY',
    messageText: '違う、予約じゃなくて書類',
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
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'ssn',
        followupIntent: 'appointment_needed',
        replyText: 'SSN窓口の予約要否を確認しましょう。'
      }
    ],
    deps: {
      generatePaidCasualReply: () => ({ replyText: '了解です。' }),
      generateGroundedReply: async () => ({ ok: false, blockedReason: 'not_used' }),
      generateDomainConciergeCandidate: async () => ({ ok: false, blockedReason: 'not_used' })
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.packet.recoverySignal, true);
  assert.equal(result.packet.normalizedConversationIntent, 'ssn');
  assert.equal(result.packet.followupIntent, 'docs_required');
  assert.equal(result.telemetry.directAnswerApplied, true);
  assert.equal(result.telemetry.strategyReason, 'recovery_signal_domain_resume');
  assert.equal(result.telemetry.priorContextUsed, true);
  assert.equal(result.telemetry.retrievalPermitReason, 'followup_context_grounding_probe');
  assert.equal(result.telemetry.selectedCandidateKind, 'clarify_candidate');
  assert.equal(result.telemetry.readinessDecision, 'refuse');
  assert.equal(result.telemetry.officialOnlySatisfied, false);
  assert.equal(result.telemetry.finalizerTemplateKind, 'refuse_template');
  assert.match(result.replyText, /公式窓口|最終確認/);
  assert.equal(result.replyText.includes('対象を絞って案内したいので'), false);
});

test('phase758: history-followup carry prefers direct domain answer over clarify candidate', async () => {
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'U_PHASE758_HISTORY',
    messageText: 'それで？',
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
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'ssn',
        followupIntent: 'docs_required',
        replyText: 'SSNは本人確認書類と在留資格が分かる書類を先にそろえるのが最優先です。'
      }
    ],
    deps: {
      generatePaidCasualReply: () => ({ replyText: '了解です。' }),
      generateGroundedReply: async () => ({ ok: false, blockedReason: 'not_used' }),
      generateDomainConciergeCandidate: async () => ({
        ok: true,
        domainIntent: 'ssn',
        conversationMode: 'concierge',
        opportunityType: 'action',
        opportunityReasonKeys: ['ssn_intent'],
        interventionBudget: 1,
        followupIntent: 'docs_required',
        conciseModeApplied: true,
        replyText: 'SSNは本人確認書類と在留資格が分かる書類を先にそろえるのが最優先です。',
        atoms: {
          situationLine: 'SSNは本人確認書類と在留資格が分かる書類を先にそろえるのが最優先です。',
          nextActions: ['不足書類を1つずつ確認する'],
          pitfall: '',
          followupQuestion: ''
        },
        auditMeta: null
      })
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.packet.followupIntentReason, 'history_followup_carry');
  assert.equal(result.packet.followupCarryFromHistory, true);
  assert.equal(result.telemetry.directAnswerApplied, true);
  assert.equal(result.telemetry.clarifySuppressed, true);
  assert.equal(result.telemetry.followupCarryFromHistory, true);
  assert.equal(result.telemetry.followupIntent, 'docs_required');
  assert.equal(result.replyText.includes('対象を絞って案内'), false);
});
