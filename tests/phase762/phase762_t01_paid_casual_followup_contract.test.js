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
  assert.equal(/SSN/i.test(result.replyText), true);
  assert.equal(result.replyText.includes('優先したい手続きを1つだけ教えてください。'), false);
  const lines = String(result.replyText || '').split('\n').map((line) => line.trim()).filter(Boolean);
  assert.equal(lines.length <= 2, true);
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
});
