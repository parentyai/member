'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDesktopProposal,
  detectBridgeFailureCode,
  evaluateConversationLoop,
  extractAppendedLines,
  parseArgs,
  toVisibleEntries,
} = require('../../tools/line_desktop_patrol/desktop_ui_bridge');

test('phase857: desktop bridge arg parser keeps repeated reply substring flags', () => {
  const parsed = parseArgs([
    'conversation-loop',
    '--run-id', 'run123',
    '--expected-chat-title', 'メンバー',
    '--text', 'hello',
    '--expected-reply-substring', '了解',
    '--expected-reply-substring', '承知',
    '--forbidden-reply-substring', 'エラー',
  ]);
  assert.equal(parsed._[0], 'conversation-loop');
  assert.equal(parsed.runId, 'run123');
  assert.deepEqual(parsed.expectedReplySubstrings, ['了解', '承知']);
  assert.deepEqual(parsed.forbiddenReplySubstrings, ['エラー']);
});

test('phase857: desktop bridge evaluation passes when reply is observed and expectations match', () => {
  const scores = evaluateConversationLoop({
    sendMode: 'execute',
    targetMatchedHeuristic: true,
    searchQueryApplied: true,
    sentText: 'テスト送信',
    beforeTranscript: 'old line',
    afterSendTranscript: 'old line\nテスト送信',
    finalTranscript: 'old line\nテスト送信\n了解しました。返信です。',
    replyObserved: true,
    expectedReplySubstrings: ['了解'],
    forbiddenReplySubstrings: ['禁止語'],
  });
  assert.equal(scores.transport, 'line_desktop_user_account');
  assert.equal(scores.sentVisible, true);
  assert.equal(scores.replyObserved, true);
  assert.equal(scores.expectedReplyMatched, true);
  assert.equal(scores.forbiddenReplyHit, false);
  assert.equal(scores.verdict, 'pass');
});

test('phase857: desktop bridge forbidden tokens only inspect appended assistant reply when available', () => {
  const scores = evaluateConversationLoop({
    sendMode: 'execute',
    targetMatchedHeuristic: true,
    searchQueryApplied: true,
    sentText: 'その2点のうち、先に確認する方を1つだけ決めて。',
    beforeTranscript: '',
    afterSendTranscript: 'その2点のうち、先に確認する方を1つだけ決めて。',
    finalTranscript: 'その2点のうち、先に確認する方を1つだけ決めて。\n先に確認するのは期限です。',
    replyObserved: true,
    expectedReplySubstrings: ['期限'],
    forbiddenReplySubstrings: ['1つだけ'],
  });
  assert.equal(scores.expectedReplyMatched, true);
  assert.equal(scores.forbiddenReplyHit, false);
  assert.equal(scores.verdict, 'pass');
});

test('phase857: desktop bridge expected tokens do not pass from user prompt alone when reply scope is available', () => {
  const scores = evaluateConversationLoop({
    sendMode: 'execute',
    targetMatchedHeuristic: true,
    searchQueryApplied: true,
    sentText: '期限を教えて。',
    beforeTranscript: '',
    afterSendTranscript: '期限を教えて。',
    finalTranscript: '期限を教えて。\n了解しました。',
    replyObserved: true,
    expectedReplySubstrings: ['期限'],
    forbiddenReplySubstrings: [],
  });
  assert.equal(scores.expectedReplyMatched, false);
  assert.equal(scores.verdict, 'fail');
});

test('phase857: desktop bridge evaluation and proposal fail closed when reply is missing', () => {
  const evaluatorScores = evaluateConversationLoop({
    sendMode: 'execute',
    targetMatchedHeuristic: true,
    searchQueryApplied: true,
    sentText: 'テスト送信',
    beforeTranscript: 'old line',
    afterSendTranscript: 'old line\nテスト送信',
    finalTranscript: 'old line\nテスト送信',
    replyObserved: false,
    expectedReplySubstrings: ['了解'],
    forbiddenReplySubstrings: [],
  });
  const proposal = buildDesktopProposal({
    runId: 'line-patrol-test',
    evaluatorScores,
  });
  assert.equal(evaluatorScores.verdict, 'fail');
  assert.equal(proposal.root_cause_category, 'operator_followup');
  assert.equal(proposal.requires_human_review, true);
});

test('phase857: desktop bridge evaluator scopes forbidden substrings to the appended reply only', () => {
  const scores = evaluateConversationLoop({
    sendMode: 'execute',
    targetMatchedHeuristic: true,
    searchQueryApplied: true,
    sentText: 'その2点のうち、先に確認する方を1つだけ決めて。',
    beforeTranscript: '12:41 メンバー 最初に確認するのは、受付期限と必要書類の2点です。',
    afterSendTranscript: '12:41 メンバー 最初に確認するのは、受付期限と必要書類の2点です。\n12:41 Arumamih$ その2点のうち、先に確認する方を1つだけ決めて。',
    finalTranscript: '12:41 メンバー 最初に確認するのは、受付期限と必要書類の2点です。\n12:41 Arumamih$ その2点のうち、先に確認する方を1つだけ決めて。\n12:42 メンバー 先に確認するのは期限です。',
    replyObserved: true,
    expectedReplySubstrings: ['期限'],
    forbiddenReplySubstrings: ['2つ'],
  });
  assert.equal(scores.expectedReplyMatched, true);
  assert.equal(scores.forbiddenReplyHit, false);
  assert.equal(scores.verdict, 'pass');
});

test('phase857: desktop bridge evaluator does not satisfy expected substrings from earlier transcript lines', () => {
  const scores = evaluateConversationLoop({
    sendMode: 'execute',
    targetMatchedHeuristic: true,
    searchQueryApplied: true,
    sentText: '期限を教えて',
    beforeTranscript: 'old line',
    afterSendTranscript: 'old line\n期限を教えて',
    finalTranscript: 'old line\n期限を教えて\nまず窓口を確認してください。',
    replyObserved: true,
    expectedReplySubstrings: ['期限'],
    forbiddenReplySubstrings: [],
  });
  assert.equal(scores.expectedReplyMatched, false);
  assert.equal(scores.verdict, 'fail');
});

test('phase857: desktop bridge maps logged-out session failures to a blocking desktop error code', () => {
  assert.equal(
    detectBridgeFailureCode('contextNotFound("session_logged_out")'),
    'desktop_session_logged_out'
  );
  assert.equal(
    detectBridgeFailureCode('desktop_session_logged_out'),
    'desktop_session_logged_out'
  );
});

test('phase857: transcript helpers preserve visible line ordering', () => {
  assert.deepEqual(extractAppendedLines('a\nb', 'a\nb\nc\n d '), ['c', 'd']);
  assert.deepEqual(toVisibleEntries('a\n\nb'), [
    { role: 'visible_text', text: 'a' },
    { role: 'visible_text', text: 'b' },
  ]);
});
