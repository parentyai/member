'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { generatePaidCasualReply } = require('../../src/usecases/assistant/generatePaidCasualReply');

test('phase762: paid casual uses domain follow-up direct answer in concise mode', () => {
  const result = generatePaidCasualReply({
    messageText: '必要書類',
    contextHint: 'ssn',
    followupIntent: 'docs_required',
    recentResponseHints: ['優先したい手続きを1つだけ教えてください。']
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'casual');
  assert.equal(/SSN|SSA/i.test(result.replyText), true);
  assert.equal(result.replyText.includes('優先したい手続きを1つだけ教えてください。'), false);
  const lines = String(result.replyText || '').split('\n').map((line) => line.trim()).filter(Boolean);
  assert.equal(lines.length <= 2, true);
  assert.equal(typeof result.procedurePacket, 'object');
  assert.equal(result.procedurePacket.domainIntent, 'ssn');
  assert.equal(Array.isArray(result.nextSteps), true);
  assert.equal(result.nextSteps.length >= 1, true);
  assert.equal(Array.isArray(result.procedurePacket.officialCheckTargets), true);
  assert.equal(result.procedurePacket.officialCheckTargets.length >= 1, true);
});

test('phase762: paid casual avoids repeating recent generic prompt line', () => {
  const repeatedHint = '続きで進めるため、いま一番気になっている点を1つだけ教えてください。';
  const result = generatePaidCasualReply({
    messageText: 'どうする',
    contextHint: 'general',
    recentResponseHints: [repeatedHint]
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'casual');
  assert.equal(result.replyText.includes(repeatedHint), false);
  assert.equal(result.replyText.includes('優先したい手続きを1つだけ教えてください。'), false);
  assert.equal(typeof result.procedurePacket, 'object');
  assert.equal(Array.isArray(result.nextSteps), true);
});

test('phase762: paid casual kickoff guide prompt returns one-line official pointer', () => {
  const result = generatePaidCasualReply({
    messageText: '初回案内として、最初に見るものを1つだけ教えて。',
    requestContract: {
      requestShape: 'summarize',
      outputForm: 'default',
      primaryDomainIntent: 'general'
    },
    contextHint: 'general',
    followupIntent: null
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'casual');
  const lines = String(result.replyText || '').split('\n').map((line) => line.trim()).filter(Boolean);
  assert.equal(lines.length, 1);
  assert.match(result.replyText, /確認先|page|ページ/);
  assert.equal(/[?？]$/.test(result.replyText), false);
  assert.equal(result.procedurePacket.replyObjective, 'decide_next_step');
});

test('phase762: paid casual journey close prompt returns two ordered lines', () => {
  const result = generatePaidCasualReply({
    messageText: 'ジャーニーを閉じる感じで、今日の順番を2行だけ。',
    requestContract: {
      requestShape: 'summarize',
      outputForm: 'two_sentences',
      primaryDomainIntent: 'general'
    },
    contextHint: 'general',
    followupIntent: null
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'casual');
  const lines = String(result.replyText || '').split('\n').map((line) => line.trim()).filter(Boolean);
  assert.deepEqual(lines, ['先に確認先を決める。', '次に必要条件か予約要否を確認する。']);
  assert.equal(typeof result.procedurePacket, 'object');
  assert.equal(Array.isArray(result.procedurePacket.overallFlow), true);
  assert.equal(result.procedurePacket.overallFlow.length >= 1, true);
});
