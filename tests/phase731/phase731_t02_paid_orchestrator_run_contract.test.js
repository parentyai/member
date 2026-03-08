'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');

test('phase731: orchestrator clarifies broad paid questions without retrieval', async () => {
  let groundedCalls = 0;
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'U_PHASE731',
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
    deps: {
      generatePaidCasualReply: () => ({ replyText: 'こんにちは。' }),
      generateGroundedReply: async () => {
        groundedCalls += 1;
        return { ok: false, blockedReason: 'unexpected' };
      },
      generateDomainConciergeCandidate: async () => ({
        ok: true,
        replyText: '状況を整理しながら進めます。まずは優先する手続きを1つ決めましょう。',
        domainIntent: 'general',
        conversationMode: 'concierge',
        opportunityType: 'action',
        opportunityReasonKeys: ['general_fallback'],
        interventionBudget: 1,
        auditMeta: null
      })
    }
  });

  assert.equal(groundedCalls, 0);
  assert.equal(result.telemetry.strategy, 'clarify');
  assert.equal(result.telemetry.retrieveNeeded, false);
  assert.equal(result.telemetry.verificationOutcome, 'passed');
  assert.equal(typeof result.telemetry.readinessDecision, 'string');
  assert.ok(Array.isArray(result.telemetry.readinessReasonCodes));
  assert.equal(result.replyText.includes('対象を絞って案内したい'), true);
});

test('phase731: orchestrator rejects legacy grounded candidate and prefers composed concierge candidate', async () => {
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'U_PHASE731',
    messageText: 'ビザ更新の必要書類を教えて',
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
        replyText: '関連情報です。\nFAQ候補:\n- [ ] 必要書類を確認する\n根拠キー: kb_1',
        output: {
          situation: '必要書類の確認です。',
          nextActions: ['必要書類を確認する'],
          risks: ['不足があると受付が止まります。'],
          gaps: ['申請州はどこですか？']
        },
        assistantQuality: {
          intentResolved: 'situation_analysis',
          kbTopScore: 0.92,
          evidenceCoverage: 1,
          blockedStage: null,
          fallbackReason: null
        },
        top1Score: 0.92,
        tokensIn: 10,
        tokensOut: 20,
        model: 'gpt-4o-mini'
      }),
      composeConciergeCandidate: async () => ({
        ok: true,
        replyText: '必要書類の確認ですね。\nまずは次の一手です。\n・必要書類を1つずつ洗い出す\n・不足があるかを確認する\n多くの人が詰まりやすいのは 書類の有効期限です。\n申請する州が分かれば、次の一手を絞れますか？',
        auditMeta: {
          evidenceOutcome: 'SUPPORTED'
        }
      }),
      generateDomainConciergeCandidate: async () => ({
        ok: true,
        replyText: '状況を整理しながら進めます。まずは優先する手続きを1つ決めましょう。',
        domainIntent: 'general',
        conversationMode: 'concierge',
        opportunityType: 'action',
        opportunityReasonKeys: ['general_fallback'],
        interventionBudget: 1,
        auditMeta: null
      })
    }
  });

  assert.equal(result.telemetry.strategy, 'grounded_answer');
  assert.equal(result.telemetry.retrieveNeeded, true);
  assert.equal(result.telemetry.judgeWinner, 'composed_concierge_candidate');
  assert.equal(result.telemetry.retrievalQuality, 'good');
  assert.equal(typeof result.telemetry.readinessDecision, 'string');
  assert.ok(Array.isArray(result.telemetry.readinessReasonCodes));
  assert.equal(result.replyText.includes('FAQ候補'), false);
  assert.equal(result.replyText.includes('根拠キー'), false);
  assert.equal(result.finalMeta.legacyTemplateHit, false);
});
