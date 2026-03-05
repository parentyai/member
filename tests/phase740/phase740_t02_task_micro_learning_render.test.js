'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { renderTaskFlexMessage } = require('../../src/usecases/tasks/renderTaskFlexMessage');

function collectBodyTexts(message) {
  const body = message && message.contents && message.contents.body && Array.isArray(message.contents.body.contents)
    ? message.contents.body.contents
    : [];
  return body
    .filter((item) => item && item.type === 'text')
    .map((item) => item.text);
}

test('phase740: task flex renders micro-learning sections when enabled', () => {
  const prev = process.env.ENABLE_TASK_MICRO_LEARNING_V1;
  process.env.ENABLE_TASK_MICRO_LEARNING_V1 = '1';
  try {
    const message = renderTaskFlexMessage({
      todoKey: 'rule_bank_open',
      task: { ruleId: 'rule_bank_open', dueAt: '2026-05-01T00:00:00.000Z' },
      taskContent: {
        title: '銀行口座を作る',
        summaryShort: ['必要書類を先に揃える', '予約枠を先に確保する'],
        topMistakes: ['住所証明の形式ミス'],
        contextTips: ['期限が近いので先に予約から進める']
      },
      linkRefs: {}
    });
    const bodyTexts = collectBodyTexts(message);
    assert.ok(bodyTexts.includes('概要'));
    assert.ok(bodyTexts.includes('よくある失敗'));
    assert.ok(bodyTexts.includes('あなたの状況の注意'));
    assert.ok(bodyTexts.some((line) => line.includes('必要書類を先に揃える')));
  } finally {
    if (prev === undefined) delete process.env.ENABLE_TASK_MICRO_LEARNING_V1;
    else process.env.ENABLE_TASK_MICRO_LEARNING_V1 = prev;
  }
});

test('phase740: task flex keeps backward compatibility when micro-learning disabled', () => {
  const prev = process.env.ENABLE_TASK_MICRO_LEARNING_V1;
  process.env.ENABLE_TASK_MICRO_LEARNING_V1 = '0';
  try {
    const message = renderTaskFlexMessage({
      todoKey: 'rule_bank_open',
      task: { ruleId: 'rule_bank_open' },
      taskContent: {
        title: '銀行口座を作る',
        manualText: 'manual',
        failureText: 'failure'
      },
      linkRefs: {}
    });
    const bodyTexts = collectBodyTexts(message);
    assert.equal(bodyTexts.includes('概要'), false);
    assert.ok(bodyTexts.includes('理解する'));
  } finally {
    if (prev === undefined) delete process.env.ENABLE_TASK_MICRO_LEARNING_V1;
    else process.env.ENABLE_TASK_MICRO_LEARNING_V1 = prev;
  }
});
