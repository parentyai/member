'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');

test('phase833: direct-answer-first does not overtake higher-priority continuation candidate', async () => {
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'u_phase833_direct_answer',
    messageText: 'それってどのタイミングでやるのがいいですか？',
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
        domainIntent: 'housing',
        followupIntent: 'next_step',
        replyText: '住まい探しは候補を絞ると進めやすいです。',
        committedFollowupQuestion: '希望エリアはどこですか？'
      }
    ],
    deps: {
      generatePaidCasualReply: () => ({ replyText: 'こんにちは。' }),
      generateGroundedReply: async () => ({
        ok: true,
        replyText: '続きとしては、希望条件と入居時期を先に固めると進みます。',
        output: {
          situation: '住まい探しの続きです。',
          nextActions: ['希望条件を固める', '入居時期を決める'],
          risks: ['条件が広いままだと比較が止まりやすいです。'],
          gaps: ['希望エリアはどこですか？']
        },
        assistantQuality: {
          intentResolved: 'situation_analysis',
          kbTopScore: 0.89,
          evidenceCoverage: 0.84,
          blockedStage: null,
          fallbackReason: null
        },
        top1Score: 0.89
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

  assert.equal(result.strategyPlan.directAnswerFirst, true);
  assert.notEqual(result.telemetry.selectedCandidateKind, 'domain_concierge_candidate');
  assert.ok(['continuation_candidate', 'grounded_candidate'].includes(result.telemetry.selectedCandidateKind));
  assert.ok(['prefer_continuation_from_history', 'prefer_grounded_over_domain_concierge', 'prefer_grounded_answer'].includes(result.telemetry.fallbackPriorityReason));
});
