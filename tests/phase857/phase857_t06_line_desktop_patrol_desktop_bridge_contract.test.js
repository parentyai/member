'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDesktopProposal,
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

test('phase857: transcript helpers preserve visible line ordering', () => {
  assert.deepEqual(extractAppendedLines('a\nb', 'a\nb\nc\n d '), ['c', 'd']);
  assert.deepEqual(toVisibleEntries('a\n\nb'), [
    { role: 'visible_text', text: 'a' },
    { role: 'visible_text', text: 'b' },
  ]);
});
