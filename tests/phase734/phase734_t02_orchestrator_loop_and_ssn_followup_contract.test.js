'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');
const { finalizeCandidate } = require('../../src/domain/llm/orchestrator/finalizeCandidate');
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

  const sourceAwareMessageOnly = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: 'それも違う。今ほしいのは説明じゃなくて、相手に送る文面だけ。',
    requestContract: {
      requestShape: 'message_template',
      outputForm: 'message_only',
      primaryDomainIntent: 'general',
      sourceReplyText: '今日は最優先の1件の期限だけ確認して、必要書類か予約要否のどちらを先に見るか決めましょう'
    }
  });
  assert.match(sourceAwareMessageOnly.replyText, /今日は最優先/);
  assert.match(sourceAwareMessageOnly.replyText, /決めてみます/);
  assert.equal(sourceAwareMessageOnly.replyText.includes('教えてもらえると助かります'), false);

  const sourceAwareNonDogmatic = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: '今の文面を、断定しすぎない言い方に直して。',
    requestContract: {
      requestShape: 'rewrite',
      outputForm: 'non_dogmatic',
      primaryDomainIntent: 'general',
      sourceReplyText: 'ご都合のよい範囲で、事前予約が必要かどうか教えていただけますか'
    }
  });
  assert.match(sourceAwareNonDogmatic.replyText, /事前予約/);
  assert.match(sourceAwareNonDogmatic.replyText, /差し支えなければ|助かります/);
  assert.equal(sourceAwareNonDogmatic.replyText.includes('もしよければ、もし差し支えなければ'), false);
  assert.equal(sourceAwareNonDogmatic.replyText.includes('優先するもの'), false);

  const sourceAwareLessBureaucratic = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: '違う、やさしくしたいんじゃなくて、事務的すぎない文面にしたい。',
    requestContract: {
      requestShape: 'rewrite',
      outputForm: 'default',
      primaryDomainIntent: 'general',
      sourceReplyText: '制度や期限が変わる話は、まず公式情報を見ておくと安心です\n必要なら、そのあとで確認ポイントを一緒に絞れます'
    }
  });
  assert.match(sourceAwareLessBureaucratic.replyText, /制度や期限|公式情報/);
  assert.equal(sourceAwareLessBureaucratic.replyText.includes('順番を一緒に整理'), false);

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

test('phase734: deepen and message-only transforms stay source-aware without generic reset', () => {
  const deepen = generatePaidDomainConciergeReply({
    domainIntent: 'school',
    messageText: 'どうやって？',
    requestContract: {
      primaryDomainIntent: 'school',
      requestShape: 'followup_continue',
      depthIntent: 'deepen',
      transformSource: 'prior_assistant',
      outputForm: 'two_sentences',
      sourceReplyText: 'その続きなら、まず対象地域の公式窓口ページで必要書類と受付期限だけ確認すると進めやすいです。',
      detailObligations: ['preserve_source_facts', 'expand_source_facts']
    }
  });
  assert.match(deepen.replyText, /必要書類/);
  assert.match(deepen.replyText, /受付期限/);
  assert.equal(deepen.replyText.includes('優先するものを1つだけ決める'), false);
  assert.equal((deepen.replyText.match(/[。！？]/g) || []).length >= 2, true);

  const messageOnly = generatePaidDomainConciergeReply({
    domainIntent: 'housing',
    messageText: '説明はいらないので、相手に送る文面だけ作って。',
    requestContract: {
      primaryDomainIntent: 'housing',
      requestShape: 'message_template',
      depthIntent: 'transform',
      transformSource: 'prior_assistant',
      outputForm: 'message_only',
      sourceReplyText: '住まい優先で進めたいので、まずは希望エリアと入居時期を整理してみます。',
      detailObligations: ['message_only', 'preserve_source_facts']
    }
  });
  assert.match(messageOnly.replyText, /住まい優先/);
  assert.match(messageOnly.replyText, /希望エリア/);
  assert.equal(/[?？]$/.test(messageOnly.replyText), false);
  assert.equal(String(messageOnly.replyText).split('\n').filter(Boolean).length, 1);
});

test('phase734: source-aware transforms keep priority and deadline facts instead of generic ask-back', () => {
  const familyLine = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: '家族に送る用に、一文だけで要点をまとめて。',
    requestContract: {
      requestShape: 'message_template',
      depthIntent: 'transform',
      outputForm: 'one_line',
      primaryDomainIntent: 'general',
      sourceReplyText: '足りていないのは、優先順位の固定と期限の見える化です。\nこの2つが決まると、進め方がかなり安定します。'
    }
  });
  assert.match(familyLine.replyText, /優先順位|期限/);
  assert.equal(familyLine.replyText.includes('教えてもらえると助かります'), false);

  const humanTone = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: '今の返しを、事務的すぎない2文にして。',
    requestContract: {
      requestShape: 'rewrite',
      depthIntent: 'transform',
      outputForm: 'two_sentences',
      primaryDomainIntent: 'general',
      sourceReplyText: '今は優先順位と期限を先に整理すると、進めやすそうです。\nこの2つが決まると、進め方がかなり安定します。'
    }
  });
  assert.match(humanTone.replyText, /優先順位|期限/);
  assert.match(humanTone.replyText, /進め方|次の一手/);
  assert.equal(humanTone.replyText.includes('この言い方なら、少しやわらかく伝えやすいです'), false);

  const deepen = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: 'どうやって？',
    requestContract: {
      requestShape: 'answer',
      depthIntent: 'deepen',
      transformSource: 'prior_assistant',
      outputForm: 'default',
      primaryDomainIntent: 'general',
      sourceReplyText: 'まずは、いちばん気になっている手続きを1つに絞るところからで大丈夫です。\nそこが決まれば、次に見ることを一緒に整理できます。',
      detailObligations: ['preserve_source_facts', 'expand_source_facts']
    }
  });
  assert.match(deepen.replyText, /具体的には|確認する順番/);
  assert.equal(deepen.replyText.includes('いま一番困っている手続きを1つだけ教えてください'), false);

  const citySchool = generatePaidDomainConciergeReply({
    domainIntent: 'school',
    messageText: 'ニューヨークで学校手続き',
    requestContract: {
      requestShape: 'answer',
      depthIntent: 'answer',
      outputForm: 'default',
      knowledgeScope: 'city',
      primaryDomainIntent: 'school',
      locationHint: {
        kind: 'city',
        cityKey: 'new-york',
        regionKey: 'NY::new-york',
        state: 'NY'
      }
    }
  });
  assert.match(citySchool.replyText, /窓口|必要書類|受付期限/);
  assert.equal(citySchool.replyText.includes('住むエリアと学区の関係'), false);

  const nonDogmaticNext = generatePaidDomainConciergeReply({
    domainIntent: 'general',
    messageText: 'ここまでを踏まえて、次の一手だけをやわらかく提案して。',
    requestContract: {
      requestShape: 'followup_continue',
      depthIntent: 'followup_continue',
      outputForm: 'non_dogmatic',
      primaryDomainIntent: 'general',
      sourceReplyText: '確認するのは、対象地域の窓口、必要書類、受付期限の3点です。\n制度名が分かるなら、その3点だけ見れば判断しやすくなります。'
    }
  });
  assert.match(nonDogmaticNext.replyText, /まずは|必要書類|受付期限/);
  assert.equal(nonDogmaticNext.replyText.includes('地域差がありそうなら'), false);
});

test('phase734: finalizer recovers deepen reply from source when selected text resets generically', () => {
  const finalized = finalizeCandidate({
    selected: {
      kind: 'grounded_candidate',
      replyText: 'いまの状況を整理します。\n次は今すぐ進める手続きを1つ決める。\nいま一番困っている手続きを1つだけ教えてください？'
    },
    requestContract: {
      requestShape: 'answer',
      depthIntent: 'deepen',
      outputForm: 'default',
      primaryDomainIntent: 'general',
      knowledgeScope: 'general',
      messageText: 'どうやって？',
      sourceReplyText: '今は、優先順位と期限を先に整理するところからで大丈夫です。\n順番と締切が見えるだけでも、次の一手を決めやすくなります。'
    },
    readinessDecision: 'allow',
    verificationOutcome: 'passed'
  });

  assert.match(finalized.replyText, /具体的には/);
  assert.match(finalized.replyText, /期限|必要書類|予約要否/);
  assert.equal(finalized.replyText.includes('いま一番困っている手続きを1つだけ教えてください'), false);
});

test('phase734: finalizer recovers city-school answer from location hint when generic school fallback leaks through', () => {
  const finalized = finalizeCandidate({
    selected: {
      kind: 'grounded_candidate',
      replyText: '学校手続きですね。\n次は学区と対象校の条件を確認する。\n学年と希望エリアが分かれば、次の一手を具体化できます？'
    },
    requestContract: {
      requestShape: 'answer',
      depthIntent: 'answer',
      outputForm: 'default',
      primaryDomainIntent: 'school',
      knowledgeScope: 'city',
      locationHint: {
        kind: 'city',
        cityKey: 'new-york',
        state: 'NY',
        regionKey: 'NY::new-york'
      }
    },
    readinessDecision: 'allow',
    verificationOutcome: 'passed'
  });

  assert.match(finalized.replyText, /教育窓口|対象校の条件|必要書類|受付期限/);
  assert.equal(finalized.replyText.includes('学校手続きですね'), false);
  assert.equal(finalized.replyText.includes('具体化できます？'), false);
});

test('phase734: finalizer recovers parent-friendly one-line rewrite when multiline housing fallback leaks through', () => {
  const finalized = finalizeCandidate({
    selected: {
      kind: 'housing_knowledge_candidate',
      replyText: '最初の1か月は身分証、住居、金融、通信、医療導線の5領域を優先する。\nまずは次の一手です。\n・希望条件を2つまで固定する\n入居時期か希望エリアは決まっていますか？'
    },
    requestContract: {
      messageText: '小学生の保護者向けに、やさしい日本語で1文にして。',
      requestShape: 'rewrite',
      depthIntent: 'transform',
      outputForm: 'one_line',
      primaryDomainIntent: 'housing',
      knowledgeScope: 'general',
      sourceReplyText: 'あとで公式確認が必要なのは、契約条件が公式窓口の案内と一致しているかです。'
    },
    readinessDecision: 'allow',
    verificationOutcome: 'passed'
  });

  assert.equal(finalized.replyText, '最初に条件を見てから、必要な書類を決めれば進めやすいです');
  assert.equal(finalized.replyText.includes('\n'), false);
  assert.equal(/[?？]$/.test(finalized.replyText), false);
});
