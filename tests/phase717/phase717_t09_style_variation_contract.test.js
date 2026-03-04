'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { renderConversationStyle } = require('../../src/domain/llm/conversation/responseStyles');

test('phase717: style rendering differs across Quick/Checklist/Timeline', () => {
  const params = {
    summary: 'ビザ更新準備が必要です。',
    nextActions: ['申請書確認', '必要書類準備', '予約確定'],
    pitfall: '期限見落とし',
    question: ''
  };

  const quick = renderConversationStyle('Quick', params);
  const checklist = renderConversationStyle('Checklist', params);
  const timeline = renderConversationStyle('Timeline', params);

  assert.notEqual(quick, checklist);
  assert.notEqual(checklist, timeline);
  assert.ok(quick.includes('まずこの順です'));
  assert.ok(checklist.includes('チェックリスト'));
  assert.ok(timeline.includes('タイムライン'));
});
