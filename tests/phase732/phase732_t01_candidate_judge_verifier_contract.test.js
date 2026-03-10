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
