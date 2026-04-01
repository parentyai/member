'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');
const { generatePaidDomainConciergeReply } = require('../../src/usecases/assistant/generatePaidDomainConciergeReply');

function futureIso(days) {
  return new Date(Date.now() + (Number(days || 90) * 24 * 60 * 60 * 1000)).toISOString();
}

function buildSavedFaqDeps(overrides) {
  const article = Object.assign({
    id: 'phase731_saved_faq',
    title: '着任後1か月の生活立ち上げ優先順位',
    body: '最初の1か月は身分証、住居、金融、通信、医療導線の5領域を優先する。未完了タスクは期限と依存関係を明示し、週次でリスクを再評価する。',
    sourceSnapshotRefs: ['phase731_official_source'],
    linkRegistryIds: ['phase731_link_registry'],
    allowedIntents: ['GENERAL', 'FAQ'],
    validUntil: futureIso(180),
    authorityLevel: 'state',
    authorityTier: 'T2_PUBLIC_DATA',
    bindingLevel: 'REFERENCE',
    riskLevel: 'low',
    status: 'active'
  }, overrides || {});
  return {
    searchFaqFromKb: async () => ({
      ok: true,
      candidates: [{ articleId: article.id }]
    }),
    getFaqArticle: async () => article
  };
}

test('phase731: orchestrator probes grounding and can prefer saved FAQ activation before concierge fallback', async () => {
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
      }),
      ...buildSavedFaqDeps()
    }
  });

  assert.equal(groundedCalls, 1);
  assert.equal(result.telemetry.strategy, 'grounded_answer');
  assert.equal(result.telemetry.retrieveNeeded, true);
  assert.match(result.telemetry.retrievalPermitReason || '', /broad_structured_grounding_probe/);
  assert.equal(result.telemetry.selectedCandidateKind, 'saved_faq_candidate');
  assert.equal(result.telemetry.fallbackPriorityReason, 'prefer_saved_faq_activation');
  assert.equal(result.telemetry.verificationOutcome, 'passed');
  assert.equal(typeof result.telemetry.readinessDecision, 'string');
  assert.ok(Array.isArray(result.telemetry.readinessReasonCodes));
  assert.equal(result.telemetry.answerReadinessLogOnly, false);
  assert.equal(result.telemetry.actionClass, 'lookup');
  assert.equal(result.telemetry.actionGatewayDecision, 'bypass');
  assert.equal(result.telemetry.actionGatewayAllowed, true);
  assert.equal(result.replyText.includes('FAQ候補'), false);
  assert.equal(result.replyText.includes('根拠キー'), false);
  assert.match(result.replyText, /最初の1か月|優先/);
});

test('phase731: orchestrator rejects legacy grounded template and prefers sanitized saved FAQ output over generic fallback', async () => {
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
      }),
      ...buildSavedFaqDeps()
    }
  });

  assert.equal(result.telemetry.strategy, 'grounded_answer');
  assert.equal(result.telemetry.retrieveNeeded, true);
  assert.equal(result.telemetry.judgeWinner, 'saved_faq_candidate');
  assert.equal(result.telemetry.selectedCandidateKind, 'saved_faq_candidate');
  assert.equal(result.telemetry.fallbackPriorityReason, 'prefer_saved_faq_activation');
  assert.equal(result.telemetry.retrievalQuality, 'good');
  assert.equal(typeof result.telemetry.readinessDecision, 'string');
  assert.ok(Array.isArray(result.telemetry.readinessReasonCodes));
  assert.equal(result.telemetry.answerReadinessLogOnly, false);
  assert.equal(result.telemetry.actionClass, 'lookup');
  assert.equal(result.telemetry.actionGatewayDecision, 'bypass');
  assert.equal(result.replyText.includes('FAQ候補'), false);
  assert.equal(result.replyText.includes('根拠キー'), false);
  assert.equal(result.finalMeta.legacyTemplateHit, false);
});

test('phase731: orchestrator applies loop-break when repetitive casual candidate repeats', async () => {
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'U_PHASE731_LOOP',
    messageText: '今日は忙しいですね',
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
        createdAt: '2026-03-08T20:00:00.000Z',
        domainIntent: 'general',
        committedFollowupQuestion: '優先したい手続きがあれば1つだけ教えてください。'
      }
    ],
    deps: {
      generatePaidCasualReply: () => ({
        replyText: '了解です。状況を短く整理しながら進めます。\n優先したい手続きがあれば1つだけ教えてください。'
      }),
      generateGroundedReply: async () => ({ ok: false, blockedReason: 'not_used' }),
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

  assert.equal(result.telemetry.strategy, 'casual');
  assert.equal(result.telemetry.judgeWinner, 'conversation_candidate');
  assert.equal(result.telemetry.loopBreakApplied, true);
  assert.equal(result.telemetry.orchestratorPathUsed, true);
  assert.equal(result.telemetry.actionClass, 'lookup');
  assert.equal(result.telemetry.actionGatewayDecision, 'bypass');
  assert.ok(result.replyText.includes('対象を絞って案内したい'));
  assert.equal(result.replyText.includes('優先したい手続きがあれば1つだけ教えてください。'), false);
});

test('phase731: school next-step question rejects generic saved FAQ reuse and falls back to school procedure guidance', async () => {
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'U_PHASE731_SCHOOL',
    messageText: '学校の途中編入で、district がまだ決まってない。今日やることを1つだけ教えて。',
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
        ok: false,
        blockedReason: 'school_grounding_missing',
        assistantQuality: {
          intentResolved: 'situation_analysis',
          kbTopScore: 0,
          evidenceCoverage: 0,
          blockedStage: 'retrieval',
          fallbackReason: 'school_grounding_missing'
        }
      }),
      generateDomainConciergeCandidate: async (params) => generatePaidDomainConciergeReply(params),
      ...buildSavedFaqDeps({
        id: 'phase731_saved_faq_general_only',
        title: '着任後1か月の生活立ち上げ優先順位',
        body: '最初の1か月は身分証、住居、金融、通信、医療導線の5領域を優先する。未完了タスクは期限と依存関係を明示し、週次でリスクを再評価する。',
        allowedIntents: ['GENERAL', 'FAQ']
      })
    }
  });

  assert.equal(result.packet.normalizedConversationIntent, 'school');
  assert.equal(result.telemetry.selectedCandidateKind, 'domain_concierge_candidate');
  assert.equal(result.telemetry.knowledgeCandidateUsed, false);
  assert.equal(result.telemetry.savedFaqRejectedReason, 'saved_faq_intent_mismatch');
  assert.equal(result.telemetry.knowledgeCandidateRejectedReason, 'faq_intent_mismatch');
  assert.equal(result.replyText.includes('身分証、住居、金融、通信、医療導線'), false);
  assert.match(result.replyText, /(district|教育窓口|enrollment|対象校)/);
});

test('phase731: school district-known immunization question keeps one-step reply on immunization requirements instead of generic school fallback', async () => {
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'U_PHASE731_SCHOOL_IMMUNIZATION',
    messageText: '学校の途中編入で、district は決まっている。予防接種も気になる。今日やることを1つだけ教えて。',
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
        ok: false,
        blockedReason: 'school_grounding_missing',
        assistantQuality: {
          intentResolved: 'situation_analysis',
          kbTopScore: 0,
          evidenceCoverage: 0,
          blockedStage: 'retrieval',
          fallbackReason: 'school_grounding_missing'
        }
      }),
      generateDomainConciergeCandidate: async (params) => generatePaidDomainConciergeReply(params),
      ...buildSavedFaqDeps({
        id: 'phase731_saved_faq_general_only_immunization',
        title: '着任後1か月の生活立ち上げ優先順位',
        body: '最初の1か月は身分証、住居、金融、通信、医療導線の5領域を優先する。未完了タスクは期限と依存関係を明示し、週次でリスクを再評価する。',
        allowedIntents: ['GENERAL', 'FAQ']
      })
    }
  });

  assert.equal(result.packet.normalizedConversationIntent, 'school');
  assert.equal(result.telemetry.selectedCandidateKind, 'domain_concierge_candidate');
  assert.equal(result.telemetry.knowledgeCandidateUsed, false);
  assert.equal(result.telemetry.savedFaqRejectedReason, 'saved_faq_intent_mismatch');
  assert.equal(result.telemetry.knowledgeCandidateRejectedReason, 'faq_intent_mismatch');
  assert.equal(result.replyText.includes('身分証、住居、金融、通信、医療導線'), false);
  assert.equal(result.replyText.includes('学校手続きですね。'), false);
  assert.equal(result.replyText.includes('住む予定の city / district を1つ仮置き'), false);
  assert.match(result.replyText, /予防接種|immunization/);
  assert.match(result.replyText, /district/);
});

test('phase731: action gateway enforce mode clarifies assist strategy without confirmation token', async () => {
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'U_PHASE731_ACTION',
    messageText: 'SSNの予約方法を教えて',
    paidIntent: 'next_action_generation',
    planInfo: { plan: 'pro', status: 'active' },
    llmFlags: {
      llmConciergeEnabled: true,
      llmWebSearchEnabled: true,
      llmStyleEngineEnabled: true,
      llmBanditEnabled: false,
      qualityEnabled: true,
      snapshotStrictMode: false,
      actionGatewayEnabled: true
    },
    actionClassOverride: 'assist',
    actionToolName: 'assist',
    confirmationToken: '',
    deps: {
      generatePaidCasualReply: () => ({ replyText: 'こんにちは。' }),
      generateGroundedReply: async () => ({
        ok: true,
        replyText: 'SSNは予約確認が必要です。',
        output: {
          situation: 'SSN手続きです。',
          nextActions: ['窓口の予約要否を確認する'],
          risks: ['窓口差があります。'],
          gaps: ['地域はどこですか？']
        },
        assistantQuality: {
          intentResolved: 'next_action_generation',
          kbTopScore: 0.9,
          evidenceCoverage: 1,
          blockedStage: null,
          fallbackReason: null
        },
        top1Score: 0.9,
        tokensIn: 10,
        tokensOut: 20,
        model: 'gpt-4o-mini'
      }),
      generateDomainConciergeCandidate: async () => ({
        ok: true,
        replyText: 'SSN手続きの次を整理します。',
        domainIntent: 'ssn',
        conversationMode: 'concierge',
        opportunityType: 'action',
        opportunityReasonKeys: ['domain_intent'],
        interventionBudget: 1,
        auditMeta: null
      })
    }
  });

  assert.equal(result.telemetry.actionClass, 'assist');
  assert.equal(result.telemetry.actionGatewayEnabled, true);
  assert.equal(result.telemetry.actionGatewayAllowed, false);
  assert.equal(result.telemetry.actionGatewayDecision, 'clarify');
  assert.equal(result.telemetry.actionGatewayReason, 'assist_confirmation_required');
  assert.equal(result.telemetry.readinessDecision, 'clarify');
  assert.match(result.replyText, /(対象手続きと期限|SSN|窓口|在留ステータス)/);
});
