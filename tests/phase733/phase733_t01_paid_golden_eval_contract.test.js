'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const { evaluateCase } = require('../../tools/run_paid_llm_golden_eval');

test('phase733: paid golden eval case enforces natural reply constraints', () => {
  const result = evaluateCase({
    id: 'sample',
    replyText: '住まい探しの相談ですね。\nまずは次の一手です。\n・希望条件を3つに絞る\n多くの人が詰まりやすいのは 審査書類です。\n希望エリアが分かれば、次の一手を具体化できますか？',
    maxActions: 3,
    expectFollowupQuestion: true,
    mustNotContain: ['FAQ候補', '根拠キー']
  });
  assert.equal(result.ok, true);
  assert.equal(result.metrics.actionCount, 1);
});

test('phase733: paid golden eval script passes bundled fixture set', () => {
  const stdout = execFileSync('node', ['tools/run_paid_llm_golden_eval.js'], {
    cwd: '/Volumes/Arumamihs/Member',
    encoding: 'utf8'
  });
  const body = JSON.parse(stdout);
  assert.equal(body.ok, true);
  assert.equal(body.failCount, 0);
  assert.equal(body.sampleCount >= 3, true);
});
