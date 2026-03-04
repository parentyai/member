'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { humanizeConversationDraft } = require('../../src/domain/llm/conversation/styleHumanizer');

test('phase717: style humanizer keeps one-line evidence footer and max three actions', () => {
  const result = humanizeConversationDraft({
    draftPacket: {
      summary: 'ビザ更新は期限確認が最優先です。',
      nextActions: ['申請書を確認する', '必要書類をそろえる', '面談日を予約する', '追加行動'],
      pitfall: '期限の見落としです。',
      question: ''
    },
    styleDecision: {
      styleId: 'Quick',
      conversationPattern: 'urgent_quick',
      askClarifying: false,
      maxActions: 3
    }
  });

  assert.ok(result.text.includes('まずこの順です。'));
  assert.equal((result.text.match(/^\d+\./gm) || []).length, 3);
  assert.equal(result.text.includes('(source:'), false);
  assert.equal(result.styleId, 'Quick');
  assert.equal(result.conversationPattern, 'urgent_quick');
  assert.ok(result.responseLength > 0);
});

test('phase717: mode A never appends evidence footer', () => {
  const result = humanizeConversationDraft({
    draftPacket: {
      summary: '状況は把握しています。',
      nextActions: ['手続き名を確定する'],
      pitfall: '手続きの特定不足です。',
      question: ''
    },
    styleDecision: {
      styleId: 'Coach',
      conversationPattern: 'coach_default',
      askClarifying: false,
      maxActions: 2
    }
  });

  assert.equal(result.text.includes('(source:'), false);
});
