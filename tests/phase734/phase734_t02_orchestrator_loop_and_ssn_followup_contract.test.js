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

function assertNoTemplateOrInternalLabels(text) {
  const message = String(text || '');
  [
    'FAQ候補',
    'CityPack候補',
    '根拠キー',
    'score=',
    '- [ ]',
    'domain_concierge_candidate',
    'clarify_candidate',
    'fallbackType',
    'routerReason',
    'contextual_domain_resume',
    'opportunityReasonKeys'
  ].forEach((token) => {
    assert.equal(message.includes(token), false, `unexpected token: ${token}`);
  });
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
  assert.equal(second.replyText === first.replyText, false);
  assert.equal(
    second.telemetry.repetitionPrevented === true || second.telemetry.selectedCandidateKind !== 'domain_concierge_candidate',
    true
  );
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
  assert.equal(docsReply.replyText.includes('ですねは'), false);
  assert.equal(bookingReply.replyText.includes('ですねは'), false);
  assert.equal(/SSN/i.test(docsReply.replyText), true);
  assert.equal(/SSN/i.test(bookingReply.replyText), true);
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
  assert.equal(second.replyText.includes('ですねは'), false);
});

test('phase734: domain fallback keeps context domain for short follow-up', () => {
  const contextSnapshot = {
    phase: 'arrival',
    topOpenTasks: [{ key: 'ssn_application', status: 'open' }]
  };

  const result = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    contextResumeDomain: 'ssn',
    messageText: '予約するの？',
    contextSnapshot,
    recentFollowupIntents: ['appointment_needed'],
    opportunityDecision: {
      conversationMode: 'concierge',
      opportunityType: 'action',
      opportunityReasonKeys: ['contextual_domain_resume'],
      interventionBudget: 1
    }
  });

  assert.equal(result.domainIntent, 'ssn');
  assert.equal(result.followupIntent, 'appointment_needed');
  assert.equal(/SSN/i.test(result.replyText), true);
  assert.equal(result.replyText.includes('ですねは'), false);
});

test('phase734: general presets answer plan difference and time horizon prompts directly', () => {
  const pricing = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: '無料プランと有料プランの違いを、回りくどくなく短く教えて。'
  });
  assert.match(pricing.replyText, /無料/);
  assert.match(pricing.replyText, /有料/);
  assert.match(pricing.replyText, /FAQ検索|状況整理/);

  const horizon = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: '今日・今週・今月の順で短く並べて。'
  });
  assert.match(horizon.replyText, /今日:/);
  assert.match(horizon.replyText, /今週:/);
  assert.match(horizon.replyText, /今月:/);
});

test('phase734: mixed housing and school prompt keeps both domains in concise answer', () => {
  const result = generatePaidDomainConciergeReply({
    domainIntent: 'housing',
    messageText: '引っ越しと学校の手続きが同時に不安。まず何から確認すべきか順番だけ教えて。'
  });

  assert.match(result.replyText, /学区|学校/);
  assert.match(result.replyText, /住むエリア|住居/);
  assert.match(result.replyText, /書類/);
});

test('phase734: general kickoff and ssn-vs-banking prompts answer directly without generic reset', () => {
  const kickoff = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: 'アメリカ赴任の準備って何から始めればいいですか？'
  });
  assert.match(kickoff.replyText, /期限がある手続き|生活基盤/);
  assert.match(kickoff.replyText, /必要書類|予約要否/);
  assert.equal(kickoff.replyText.includes('優先したい手続きを1つだけ教えてください'), false);

  const compare = generatePaidDomainConciergeReply({
    domainIntent: 'ssn',
    messageText: 'SSNと銀行口座の手続き、先にどっちを進めるべきか理由つきで短く教えて。'
  });
  assert.match(compare.replyText, /先にSSN/);
  assert.match(compare.replyText, /理由/);
  assert.match(compare.replyText, /銀行|口座/);
});

test('phase734: utility transformation and correction presets stay concise and task-shaped', () => {
  const tenMinute = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: 'それなら最初の10分は何をする？'
  });
  assert.match(tenMinute.replyText, /最初の10分/);
  assert.match(tenMinute.replyText, /必要書類|窓口/);

  const missingTwo = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: '今の進め方で足りていないものを、2つだけ教えて。'
  });
  assert.match(missingTwo.replyText, /優先順位の固定/);
  assert.match(missingTwo.replyText, /期限の見える化/);
  assert.equal(missingTwo.replyText.includes('いま一番困っている手続きを1つだけ教えてください'), false);

  const familyLine = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: 'さっきの説明を、家族に送れる一文にして。'
  });
  assert.equal(String(familyLine.replyText || '').split('\n').length, 1);
  assert.match(familyLine.replyText, /大丈夫そう/);

  const todayLine = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: '今の返答の中で、今日やることだけ1行にして。'
  });
  assert.equal(String(todayLine.replyText || '').split('\n').length, 1);
  assert.match(todayLine.replyText, /今日は最優先/);

  const housingCorrection = generatePaidDomainConciergeReply({
    domainIntent: 'school',
    messageText: 'それは違う。学校じゃなくて住まい優先で考え直して。'
  });
  assert.match(housingCorrection.replyText, /住まい優先/);
  assert.match(housingCorrection.replyText, /入居時期|希望エリア/);
  assert.equal(housingCorrection.replyText.includes('学校手続きの相談'), false);

  const schoolCorrection = generatePaidDomainConciergeReply({
    domainIntent: 'housing',
    messageText: '今度は逆で、住まいより学校優先で考え直して。'
  });
  assert.match(schoolCorrection.replyText, /学校優先|学区|対象校/);
  assert.equal(schoolCorrection.replyText.includes('住まい探しですね'), false);

  const anxietyNarrow = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: '不安が強い前提で、やることを1つだけに絞って。'
  });
  assert.equal(String(anxietyNarrow.replyText || '').split('\n').length, 1);
  assert.match(anxietyNarrow.replyText, /期限だけ確認/);

  const officialCriteria = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: '公式情報を確認すべき場面かどうか、判断基準だけ教えて。'
  });
  assert.match(officialCriteria.replyText, /制度・期限・必要書類・費用/);
  assert.match(officialCriteria.replyText, /公式窓口/);

  const reservationTemplate = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: '予約が必要かどうかを相手に失礼なく聞く短文を1つ作って。'
  });
  assert.equal(String(reservationTemplate.replyText || '').split('\n').length, 1);
  assert.match(reservationTemplate.replyText, /事前予約が必要かどうか/);

  const messageOnly = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: 'それも違う。今ほしいのは説明じゃなくて、相手に送る文面だけ。'
  });
  assert.equal(String(messageOnly.replyText || '').split('\n').length, 1);
  assert.match(messageOnly.replyText, /教えてもらえると助かります/);

  const humanTone = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: '今の返し、少し硬い。人に話す感じで2文にして。'
  });
  assert.equal(String(humanTone.replyText || '').split('\n').length, 2);
  assert.match(humanTone.replyText, /安心/);
  assert.match(humanTone.replyText, /確認ポイント/);

  const softerTone = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: '違う、やさしくしたいんじゃなくて、事務的すぎない文面にしたい。'
  });
  assert.equal(String(softerTone.replyText || '').split('\n').length, 1);
  assert.match(softerTone.replyText, /一緒に整理/);

  const hedgedRewrite = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: '今の文面を、断定しすぎない言い方に直して。'
  });
  assert.equal(String(hedgedRewrite.replyText || '').split('\n').length, 1);
  assert.match(hedgedRewrite.replyText, /無理が少なそう/);

  const nonDogmaticNext = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: 'ここまでの会話を踏まえて、次の一手だけをやわらかく提案して。'
  });
  assert.match(nonDogmaticNext.replyText, /次の一手としては/);
  assert.match(nonDogmaticNext.replyText, /よさそう/);

  [familyLine, todayLine, housingCorrection, anxietyNarrow, officialCriteria, reservationTemplate, messageOnly, humanTone, softerTone, hedgedRewrite, nonDogmaticNext]
    .forEach((item) => {
      assertNoTemplateOrInternalLabels(item.replyText);
      assert.equal(String(item.replyText || '').includes('まずは次の一手から進めましょう'), false);
      assert.equal(String(item.replyText || '').includes('優先したい手続きがあれば1つだけ教えてください'), false);
    });
  [familyLine, todayLine, reservationTemplate, messageOnly, softerTone, hedgedRewrite]
    .forEach((item) => {
      assert.equal(String(item.replyText || '').includes('・'), false);
    });
  assert.notEqual(messageOnly.replyText, softerTone.replyText);
  assert.notEqual(hedgedRewrite.replyText, nonDogmaticNext.replyText);
});
