'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { judgeCandidates } = require('../../src/domain/llm/orchestrator/judgeCandidates');
const { verifyCandidate } = require('../../src/domain/llm/orchestrator/verifyCandidate');

test('phase732: judge rejects legacy template candidate and keeps safe natural candidate', () => {
  const judged = judgeCandidates({
    packet: {
      normalizedConversationIntent: 'general'
    },
    strategy: 'grounded_answer',
    candidates: [
      {
        id: 'legacy_candidate',
        replyText: '関連情報です。\nFAQ候補:\n- [ ] 確認する\n根拠キー: kb_1',
        domainIntent: 'general',
        retrievalQuality: 'good'
      },
      {
        id: 'safe_candidate',
        replyText: 'まず状況を整理します。\n・期限を確認する\n申請州はどこですか？',
        domainIntent: 'general',
        retrievalQuality: 'mixed'
      }
    ]
  });

  assert.equal(judged.judgeWinner, 'safe_candidate');
  assert.equal(judged.judgeScores[0].rejectedReasons.length, 0);
  assert.ok(judged.judgeScores.some((row) => row.candidateId === 'legacy_candidate' && row.rejectedReasons.includes('legacy_template')));
});

test('phase732: verifier converts weak evidence answers into clarify/hedged outputs with contradiction flags', () => {
  const clarify = verifyCandidate({
    packet: {
      normalizedConversationIntent: 'general',
      recentAssistantCommitments: ['必要書類を確認する']
    },
    selected: {
      id: 'grounded_candidate',
      kind: 'grounded_candidate',
      replyText: '必要書類を確認してください。'
    },
    evidenceSufficiency: 'clarify'
  });
  assert.equal(clarify.verificationOutcome, 'clarify');
  assert.ok(clarify.contradictionFlags.includes('insufficient_evidence'));

  const hedged = verifyCandidate({
    packet: {
      normalizedConversationIntent: 'general',
      recentAssistantCommitments: []
    },
    selected: {
      id: 'grounded_candidate',
      kind: 'grounded_candidate',
      replyText: '必要書類はすぐ提出できます。'
    },
    evidenceSufficiency: 'answer_with_hedge'
  });
  assert.equal(hedged.verificationOutcome, 'hedged');
  assert.ok(hedged.selected.replyText.includes('最終確認'));
  assert.ok(hedged.contradictionFlags.includes('weak_evidence'));
});

test('phase732: verifier clarify reply stays domain-aware for follow-up intents and avoids repeated generic line', () => {
  const genericLine = '対象を絞って案内したいので、いま一番気になっている手続きを1つ教えてください。';
  const clarify = verifyCandidate({
    packet: {
      normalizedConversationIntent: 'ssn',
      followupIntent: 'docs_required',
      recentResponseHints: [genericLine],
      recentAssistantCommitments: [genericLine]
    },
    selected: {
      id: 'grounded_candidate',
      kind: 'grounded_candidate',
      replyText: '書類を用意してください。'
    },
    evidenceSufficiency: 'clarify'
  });
  assert.equal(clarify.verificationOutcome, 'clarify');
  assert.ok(/SSN|在留/.test(clarify.selected.replyText));
  assert.equal(clarify.selected.replyText.includes(genericLine), false);
});

test('phase732: verifier clarify output does not leak internal labels or retrieval template markers', () => {
  const clarify = verifyCandidate({
    packet: {
      normalizedConversationIntent: 'general',
      followupIntent: 'next_step',
      recentResponseHints: ['domain_concierge_candidate'],
      recentAssistantCommitments: []
    },
    selected: {
      id: 'internal_shape_candidate',
      kind: 'grounded_candidate',
      replyText: 'domain_concierge_candidate fallbackType=utility_transform_direct_answer\nFAQ候補:\n根拠キー: kb_1'
    },
    evidenceSufficiency: 'clarify'
  });

  assert.equal(clarify.verificationOutcome, 'clarify');
  [
    'domain_concierge_candidate',
    'fallbackType',
    'routerReason',
    'FAQ候補',
    'CityPack候補',
    '根拠キー'
  ].forEach((token) => {
    assert.equal(clarify.selected.replyText.includes(token), false, `unexpected token: ${token}`);
  });
});

test('phase732: city-scoped grounded answer prefers concierge direct answer over generic saved faq fallback', () => {
  const judged = judgeCandidates({
    packet: {
      normalizedConversationIntent: 'school',
      requestShape: 'answer',
      knowledgeScope: 'city',
      locationHint: {
        kind: 'city',
        cityKey: 'new-york'
      }
    },
    strategy: 'grounded_answer',
    candidates: [
      {
        id: 'saved_faq_candidate',
        kind: 'saved_faq_candidate',
        replyText: '最初の1か月は身分証、住居、金融、通信、医療導線の5領域を優先する。\nまずは次の一手です。\n・地域条件と初期費用を先に確認する\n赴任先の都市か住むエリアは決まっていますか？',
        domainIntent: 'school',
        retrievalQuality: 'good'
      },
      {
        id: 'domain_concierge_candidate',
        kind: 'domain_concierge_candidate',
        replyText: '都市が分かっているなら、まず現地の教育窓口で対象校の条件、必要書類、受付期限の3点だけ確認すると進めやすいです。\nその3点が見えると、次に何を優先するかかなり決めやすくなります。',
        domainIntent: 'school',
        retrievalQuality: 'none',
        directAnswerCandidate: true
      }
    ]
  });

  assert.equal(judged.judgeWinner, 'domain_concierge_candidate');
});

test('phase732: state-scoped grounded answer prefers concierge direct answer over generic saved faq fallback', () => {
  const judged = judgeCandidates({
    packet: {
      normalizedConversationIntent: 'school',
      requestShape: 'answer',
      locationHint: {
        kind: 'state',
        state: 'NY'
      }
    },
    strategy: 'grounded_answer',
    candidates: [
      {
        id: 'saved_faq_candidate',
        kind: 'saved_faq_candidate',
        replyText: '最初の1か月は身分証、住居、金融、通信、医療導線の5領域を優先する。\nまずは次の一手です。\n・地域条件と初期費用を先に確認する\n赴任先の都市か住むエリアは決まっていますか？',
        domainIntent: 'school',
        retrievalQuality: 'good'
      },
      {
        id: 'domain_concierge_candidate',
        kind: 'domain_concierge_candidate',
        replyText: '州だけ分かっている段階なら、まず対象の市区ごとの教育窓口、必要書類、受付期限の3点を確認すると進めやすいです。\n市区が決まると、次の一手をかなり具体化できます。',
        domainIntent: 'school',
        retrievalQuality: 'none',
        directAnswerCandidate: true
      }
    ]
  });

  assert.equal(judged.judgeWinner, 'domain_concierge_candidate');
});
