'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');

test('phase833: orchestrator emits strategy priority and retrieval permit telemetry', async () => {
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'u_phase833_telemetry',
    messageText: 'アメリカ赴任の準備って何から始めればいいですか？',
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
        replyText: '最初は優先順位を決めると進めやすいです。',
        output: {
          situation: '赴任準備の整理です。',
          nextActions: ['優先手続きを決める', '期限を並べる'],
          risks: ['順番が曖昧だと手戻りしやすいです。'],
          gaps: ['出発時期は決まっていますか？']
        },
        assistantQuality: {
          intentResolved: 'situation_analysis',
          kbTopScore: 0.9,
          evidenceCoverage: 0.82,
          blockedStage: null,
          fallbackReason: null
        },
        top1Score: 0.9
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

  assert.equal(result.telemetry.strategyReason, 'broad_question_grounding_probe');
  assert.equal(result.telemetry.strategyPriorityVersion, 'v2');
  assert.ok(Array.isArray(result.telemetry.strategyAlternativeSet));
  assert.ok(result.telemetry.strategyAlternativeSet.includes('structured_answer'));
  assert.equal(result.telemetry.retrievalPermitReason, 'broad_structured_grounding_probe');
  assert.equal(result.telemetry.groundedCandidateAvailable, true);
  assert.equal(result.telemetry.structuredCandidateAvailable, true);
  assert.equal(typeof result.telemetry.fallbackPriorityReason, 'string');
});
