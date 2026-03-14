'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationPacket } = require('../../src/domain/llm/orchestrator/buildConversationPacket');
const { buildStrategyPlan } = require('../../src/domain/llm/orchestrator/strategyPlanner');
const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');

test('phase833: follow-up with prior context prefers continuation over generic reset', async () => {
  const recentActionRows = [{
    createdAt: new Date().toISOString(),
    domainIntent: 'housing',
    followupIntent: 'next_step',
    replyText: '住まい探しは候補物件を3件まで絞ると進めやすいです。',
    committedFollowupQuestion: '希望エリアはどこですか？'
  }];

  const packet = buildConversationPacket({
    lineUserId: 'u_phase833_followup',
    messageText: 'それってどのタイミングでやるのがいいですか？',
    recentActionRows,
    planInfo: { plan: 'pro', status: 'active' },
    paidIntent: 'situation_analysis',
    llmFlags: { llmConciergeEnabled: true }
  });
  const plan = buildStrategyPlan(packet);

  assert.equal(packet.priorContextUsed, true);
  assert.equal(packet.genericFallbackSlice, 'followup');
  assert.equal(plan.strategy, 'grounded_answer');
  assert.ok(plan.strategyAlternativeSet.includes('continuation'));

  const result = await runPaidConversationOrchestrator({
    lineUserId: 'u_phase833_followup',
    messageText: 'それってどのタイミングでやるのがいいですか？',
    recentActionRows,
    planInfo: { plan: 'pro', status: 'active' },
    paidIntent: 'situation_analysis',
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
        replyText: '内見や申込の前に、希望条件と入居時期を先にそろえると進めやすいです。',
        output: {
          situation: '住まい探しの続きです。',
          nextActions: ['希望条件を固定する', '入居時期を決める'],
          risks: ['条件が固まらないと候補比較が止まりやすいです。'],
          gaps: ['入居希望日は決まっていますか？']
        },
        assistantQuality: {
          intentResolved: 'situation_analysis',
          kbTopScore: 0.9,
          evidenceCoverage: 0.84,
          blockedStage: null,
          fallbackReason: null
        },
        top1Score: 0.9
      }),
      generateDomainConciergeCandidate: async () => ({
        ok: true,
        replyText: '住まい探しの続きですね。まずは優先条件を1つ決めましょう。',
        domainIntent: 'housing',
        conversationMode: 'concierge',
        opportunityType: 'action',
        opportunityReasonKeys: ['contextual_domain_resume'],
        interventionBudget: 1,
        followupIntent: 'next_step',
        conciseModeApplied: true,
        auditMeta: null
      })
    }
  });

  assert.ok(['continuation_candidate', 'grounded_candidate'].includes(result.telemetry.selectedCandidateKind));
  assert.equal(result.telemetry.priorContextUsed, true);
  assert.equal(result.telemetry.continuationCandidateAvailable, true);
  assert.match(String(result.telemetry.retrievalPermitReason), /followup_context_grounding_probe/);
});
