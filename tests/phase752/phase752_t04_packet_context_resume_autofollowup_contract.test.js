'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildConversationPacket } = require('../../src/domain/llm/orchestrator/buildConversationPacket');

test('phase752: low-information contextual resume auto-fills next_step followup and context carry score', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT',
    messageText: '必要書類',
    routerReason: 'default_casual',
    contextSnapshot: {
      topOpenTasks: [{ key: 'ssn_application', status: 'open' }]
    },
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'ssn',
        followupIntent: null,
        committedNextActions: ['必要書類を先に整理する']
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.contextResume, true);
  assert.equal(packet.normalizedConversationIntent, 'ssn');
  assert.equal(packet.followupIntent === 'next_step' || packet.followupIntent === 'docs_required', true);
  assert.equal(packet.routerReason, 'contextual_domain_resume');
  assert.equal(packet.contextCarryScore >= 0.8, true);
});

test('phase752: context resume cue without ultra-short message still resumes prior domain', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_CUE',
    messageText: 'それならどうする？',
    routerReason: 'default_casual',
    contextSnapshot: {
      topOpenTasks: [{ key: 'school_registration', status: 'open' }]
    },
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'school',
        followupIntent: 'next_step',
        committedNextActions: ['対象校を1校に絞る']
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.contextResume, true);
  assert.equal(packet.contextResumeCue, true);
  assert.equal(packet.normalizedConversationIntent, 'school');
  assert.equal(packet.followupIntent, 'next_step');
  assert.equal(packet.routerReason, 'contextual_domain_resume');
});

test('phase752: recovery correction prefers docs_required followup intent on contextual resume', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_RECOVERY',
    messageText: '違う、予約じゃなくて書類',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'ssn',
        followupIntent: 'appointment_needed',
        replyText: 'SSN窓口の予約要否を先に確認しましょう。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.recoverySignal, true);
  assert.equal(packet.contextResume, true);
  assert.equal(packet.normalizedConversationIntent, 'ssn');
  assert.equal(packet.recoveryFollowupIntent, 'docs_required');
  assert.equal(packet.followupIntent, 'docs_required');
});

test('phase752: explicit housing correction does not get hijacked by prior school context', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_HOUSING_CORRECTION',
    messageText: 'それは違う。学校じゃなくて住まい優先で考え直して。',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'school',
        followupIntent: 'next_step',
        replyText: '学校手続きの次は、対象校を1校に絞って必要書類を先に確定するのが最短です。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.recoverySignal, true);
  assert.equal(packet.contextResume, false);
  assert.equal(packet.contextResumeDomain, null);
  assert.equal(packet.normalizedConversationIntent, 'housing');
});

test('phase752: history carry keeps previous followup intent for ultra-short confirmation turn', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_HISTORY',
    messageText: 'それで？',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'school',
        followupIntent: 'docs_required',
        replyText: '学校手続きは住所証明と予防接種記録を先にそろえるのが最優先です。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.contextResume, true);
  assert.equal(packet.normalizedConversationIntent, 'school');
  assert.equal(packet.followupIntent, 'docs_required');
  assert.equal(packet.followupIntentReason, 'history_followup_carry');
  assert.equal(packet.followupCarryFromHistory, true);
  assert.equal(packet.contextCarryScore >= 0.85, true);
});

test('phase752: snapshot domain does not hijack general planning followup without prior domain history', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_GENERAL',
    messageText: 'それなら最初の5分は何をする？',
    routerReason: 'default_casual',
    contextSnapshot: {
      topOpenTasks: [{ key: 'school_registration', status: 'open' }]
    },
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'general',
        followupIntent: 'next_step',
        replyText: '優先する3つは、期限が近いこと、後続に影響すること、今日すぐ動かせることです。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.contextResume, false);
  assert.equal(packet.contextResumeDomain, null);
  assert.equal(packet.normalizedConversationIntent, 'general');
  assert.equal(packet.followupIntent, 'next_step');
});

test('phase752: reverse correction supersedes prior housing carry and keeps school intent', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_SCHOOL_CORRECTION',
    messageText: '今度は逆で、住まいより学校優先で考え直して。',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'housing',
        followupIntent: 'next_step',
        replyText: '住まい探しの次は、候補物件を3件まで絞って進めましょう。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.recoverySignal, true);
  assert.equal(packet.contextResume, false);
  assert.equal(packet.contextResumeDomain, null);
  assert.equal(packet.normalizedConversationIntent, 'school');
});

test('phase752: echoed prior assistant line reuses matched prior general source instead of stale ssn carry', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_ECHO_MATCH',
    messageText: '特に申請可否や法的条件に触れるときは、案内より先に公式窓口で最終確認してください。',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'general',
        replyText: '制度・期限・必要書類・費用が変わりうる話なら、公式情報を確認する場面です。\n特に申請可否や法的条件に触れるときは、案内より先に公式窓口で最終確認してください。'
      },
      {
        createdAt: new Date(Date.now() - 60_000).toISOString(),
        domainIntent: 'ssn',
        followupIntent: 'next_step',
        replyText: 'SSNの次は、必要書類を1つの一覧にまとめてから窓口の予約要否を確認するのが確実です。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.echoOfPriorAssistant, true);
  assert.equal(packet.sourceReplyText.includes('公式窓口'), true);
  assert.equal(packet.normalizedConversationIntent, 'general');
  assert.equal(packet.contextResumeDomain, null);
});

test('phase752: echoed second line of multiline reply still matches prior assistant source', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_ECHO_LINE_ONLY',
    messageText: 'この2つが決まると、進め方がかなり安定します。',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'general',
        replyText: '足りていないのは、優先順位の固定と期限の見える化です。\nこの2つが決まると、進め方がかなり安定します。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.echoOfPriorAssistant, true);
  assert.equal(packet.sourceReplyText.includes('優先順位の固定'), true);
  assert.equal(packet.requestShape, 'followup_continue');
  assert.equal(packet.normalizedConversationIntent, 'general');
});

test('phase752: echoed mixed-domain document line stays general and preserves both domains from source reply', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_ECHO_MIXED_ORDER',
    messageText: '次に、住所証明など共通で使う書類をまとめます。',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'housing',
        replyText: '順番は、住むエリアと学区の関係を先に確認することです\n次に、住所証明など共通で使う書類をまとめます\nそのうえで、住居候補と学校候補を同じエリア軸で絞り込みましょう'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.echoOfPriorAssistant, true);
  assert.equal(packet.requestShape, 'followup_continue');
  assert.equal(packet.normalizedConversationIntent, 'general');
  assert.deepEqual(packet.domainSignals, ['housing', 'school']);
  assert.match(packet.sourceReplyText, /住居候補と学校候補/);
});

test('phase752: family one-line transform anchors to latest assistant source without stale context resume', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_FAMILY_LINE',
    messageText: '家族に送る用に、一文だけで要点をまとめて。',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'general',
        replyText: '足りていないのは、優先順位の固定と期限の見える化です。\nこの2つが決まると、進め方がかなり安定します。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.requestShape, 'message_template');
  assert.equal(packet.transformSource, 'prior_assistant');
  assert.match(packet.sourceReplyText, /優先順位の固定/);
  assert.equal(packet.contextResume, false);
  assert.equal(packet.normalizedConversationIntent, 'general');
});

test('phase752: deepen cue uses latest assistant source instead of generic followup fallback', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_DEEPEN_SOURCE',
    messageText: 'どうやって？',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'general',
        replyText: 'まずは、いちばん気になっている手続きを1つに絞るところからで大丈夫です。\nそこが決まれば、次に見ることを一緒に整理できます。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.requestShape, 'answer');
  assert.equal(packet.depthIntent, 'deepen');
  assert.equal(packet.transformSource, 'prior_assistant');
  assert.match(packet.sourceReplyText, /いちばん気になっている手続きを1つ/);
  assert.equal(packet.answerability, 'answer_now');
});

test('phase752: criteria-only list request avoids stale school continuation after city hint turn', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_CITY_CRITERIA',
    messageText: '地域によって違うなら、確認する項目名だけ並べて。',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'school',
        followupIntent: 'next_step',
        replyText: '学校手続きですね。\n次は学区と対象校の条件を確認する。\n学年と希望エリアが分かれば、次の一手を具体化できます。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.requestShape, 'criteria');
  assert.equal(packet.outputForm, 'criteria_only');
  assert.equal(packet.contextResume, false);
  assert.equal(packet.normalizedConversationIntent, 'general');
});

test('phase752: direct low-friction prompts mark avoid_question_back without losing school intent', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_DIRECT_LOW_FRICTION',
    messageText: 'ニューヨークの学校手続きで最初に確認することを2点だけ教えて。',
    routerReason: 'default_casual',
    llmFlags: {}
  });

  assert.equal(packet.requestShape, 'summarize');
  assert.equal(packet.normalizedConversationIntent, 'school');
  assert.equal(packet.detailObligations.includes('avoid_question_back'), true);
});

test('phase752: two-line close prompt maps to two-sentence output form and suppresses ask-back', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_TWO_LINE_CLOSE',
    messageText: '最後に、今日やる順番を2行でまとめて。',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'school',
        replyText: '最初に確認するのは、受付期限と必要書類の2点です。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.outputForm, 'two_sentences');
  assert.equal(packet.detailObligations.includes('avoid_question_back'), true);
});

test('phase752: parent-friendly one-line rewrite keeps rewrite contract even with prior housing context', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_PARENT_FRIENDLY',
    messageText: '小学生の保護者向けに、やさしい日本語で1文にして。',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'housing',
        replyText: '住まい探しでは、同じ書類確認なら、次は不足しやすい書類を1つずつ潰すのが最短です。\n次は不足しやすい書類を1つずつ確認しましょう。\n希望エリアと入居時期を教えてもらえますか？'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.requestShape, 'rewrite');
  assert.equal(packet.outputForm, 'one_line');
  assert.equal(packet.detailObligations.includes('avoid_question_back'), true);
});
