'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { applyAnswerReadinessDecision } = require('../../src/domain/llm/quality/applyAnswerReadinessDecision');

test('phase749: readiness enforce keeps allow reply unchanged', () => {
  const result = applyAnswerReadinessDecision({
    decision: 'allow',
    replyText: '状況を整理しました。次の一手を進めましょう。'
  });
  assert.equal(result.decision, 'allow');
  assert.equal(result.replyText, '状況を整理しました。次の一手を進めましょう。');
  assert.equal(result.enforced, false);
});

test('phase749: readiness enforce replaces clarify/refuse and appends hedge safely', () => {
  const clarify = applyAnswerReadinessDecision({
    decision: 'clarify',
    replyText: '元の文面'
  });
  assert.equal(clarify.decision, 'clarify');
  assert.equal(clarify.enforced, true);
  assert.equal(clarify.replyText.includes('まず対象手続きと期限'), true);

  const refuse = applyAnswerReadinessDecision({
    decision: 'refuse',
    replyText: '元の文面'
  });
  assert.equal(refuse.decision, 'refuse');
  assert.equal(refuse.enforced, true);
  assert.equal(refuse.replyText.includes('公式窓口'), true);

  const hedged = applyAnswerReadinessDecision({
    decision: 'hedged',
    replyText: '次の一手を整理します。'
  });
  assert.equal(hedged.decision, 'hedged');
  assert.equal(hedged.enforced, true);
  assert.equal(hedged.replyText.includes('最終確認'), true);
});
