'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');
const { generatePaidCasualReply } = require('../../src/usecases/assistant/generatePaidCasualReply');
const { generatePaidDomainConciergeReply } = require('../../src/usecases/assistant/generatePaidDomainConciergeReply');

function buildBasePayload(overrides) {
  return Object.assign({
    lineUserId: 'U_PHASE734',
    planInfo: { plan: 'pro', status: 'active' },
    explicitPaidIntent: null,
    paidIntent: 'situation_analysis',
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
      phase: 'arrival',
      topOpenTasks: [
        { key: 'school_registration', status: 'open' }
      ]
    },
    recentActionRows: [],
    opportunityDecision: {
      conversationMode: 'concierge',
      opportunityType: 'action',
      opportunityReasonKeys: ['school_intent'],
      interventionBudget: 1,
      suggestedAtoms: {
        nextActions: ['対象校を1校に絞る'],
        pitfall: '提出書類の不足で止まりやすいです。',
        question: '学年と希望エリアを教えてもらえますか？'
      }
    }
  }, overrides || {});
}

test('phase734: orchestrator loop-break prevents identical repeated reply on contextual resume', async () => {
  const repeatedReply = '学校手続きの次は、対象校を1校に絞って必要書類を先に確定するのが最短です。';
  const deps = {
    generatePaidCasualReply,
    generateGroundedReply: async () => ({ ok: false, blockedReason: 'not_used' }),
    generateDomainConciergeCandidate: async () => ({
      ok: true,
      domainIntent: 'school',
      conversationMode: 'concierge',
      opportunityType: 'action',
      opportunityReasonKeys: ['school_intent'],
      interventionBudget: 1,
      followupIntent: 'next_step',
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
  };

  const first = await runPaidConversationOrchestrator(buildBasePayload({
    messageText: '学校',
    routerMode: 'problem',
    routerReason: 'school_intent_detected',
    deps
  }));

  const second = await runPaidConversationOrchestrator(buildBasePayload({
    messageText: 'ヒザだって',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'school',
        replyText: first.replyText,
        committedFollowupQuestion: '学年と希望エリアを教えてもらえますか？'
      }
    ],
    deps
  }));

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.telemetry.contextResumeDomain, 'school');
  assert.equal(second.telemetry.repetitionPrevented, true);
  assert.equal(second.replyText === first.replyText, false);
});

test('phase734: ssn followup intents stay concise and avoid generic loop prompt', async () => {
  const contextSnapshot = {
    phase: 'arrival',
    topOpenTasks: [{ key: 'ssn_application', status: 'open' }]
  };

  const docsReply = generatePaidDomainConciergeReply({
    domainIntent: 'ssn',
    messageText: 'SSNの必要書類は？',
    followupIntent: 'docs_required',
    contextSnapshot,
    opportunityDecision: {
      conversationMode: 'concierge',
      opportunityType: 'action',
      opportunityReasonKeys: ['ssn_intent'],
      interventionBudget: 1,
      suggestedAtoms: {
        nextActions: ['必要書類を先にそろえる'],
        pitfall: '本人確認書類の不備で再訪になりやすいです。',
        question: '在留ステータスは何ですか？'
      }
    }
  });

  const bookingReply = generatePaidDomainConciergeReply({
    domainIntent: 'ssn',
    messageText: '予約するの？',
    followupIntent: 'appointment_needed',
    contextSnapshot,
    opportunityDecision: {
      conversationMode: 'concierge',
      opportunityType: 'action',
      opportunityReasonKeys: ['ssn_intent'],
      interventionBudget: 1,
      suggestedAtoms: {
        nextActions: ['窓口の予約要否を確認する'],
        pitfall: '窓口要件の違いで手戻りしやすいです。',
        question: '最寄りの窓口は決まっていますか？'
      }
    }
  });

  const docsLines = String(docsReply.replyText || '').split('\n').filter((line) => line.trim());
  const bookingLines = String(bookingReply.replyText || '').split('\n').filter((line) => line.trim());

  assert.equal(docsReply.followupIntent, 'docs_required');
  assert.equal(bookingReply.followupIntent, 'appointment_needed');
  assert.equal(docsLines.length <= 3, true);
  assert.equal(bookingLines.length <= 3, true);
  assert.equal(docsReply.replyText.includes('優先したい手続きがあれば1つだけ教えてください。'), false);
  assert.equal(bookingReply.replyText.includes('優先したい手続きがあれば1つだけ教えてください。'), false);
});

test('phase734: repeated docs follow-up rotates concise reply and avoids identical line reuse', () => {
  const contextSnapshot = {
    phase: 'arrival',
    topOpenTasks: [{ key: 'ssn_application', status: 'open' }]
  };

  const first = generatePaidDomainConciergeReply({
    domainIntent: 'ssn',
    messageText: '必要書類は？',
    followupIntent: 'docs_required',
    contextSnapshot,
    recentFollowupIntents: ['docs_required'],
    recentResponseHints: ['同じ書類確認なら、次は不足しやすい書類を1つずつ潰すのが最短です。']
  });

  const second = generatePaidDomainConciergeReply({
    domainIntent: 'ssn',
    messageText: '必要書類は？',
    followupIntent: 'docs_required',
    contextSnapshot,
    recentFollowupIntents: ['docs_required', 'docs_required'],
    recentResponseHints: [first.replyText]
  });

  assert.equal(typeof first.replyText, 'string');
  assert.equal(typeof second.replyText, 'string');
  assert.equal(first.replyText.length > 0, true);
  assert.equal(second.replyText.length > 0, true);
  assert.equal(second.replyText === first.replyText, false);
  assert.equal(second.replyText.includes('優先したい手続きがあれば1つだけ教えてください。'), false);
});
