'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  parseJourneyLineCommand,
  parseJourneyPostbackData
} = require('../../src/domain/journey/lineCommandParsers');

test('phase741: line parser resolves task os entry commands', () => {
  assert.deepEqual(parseJourneyLineCommand('今やる'), { action: 'next_tasks' });
  assert.deepEqual(parseJourneyLineCommand('今日の3つ'), { action: 'next_tasks' });
  assert.deepEqual(parseJourneyLineCommand('今週の期限'), { action: 'due_soon_tasks' });
  assert.deepEqual(parseJourneyLineCommand('地域手続き'), { action: 'regional_procedures' });
  assert.deepEqual(parseJourneyLineCommand('やること一覧'), { action: 'todo_list' });
  assert.deepEqual(parseJourneyLineCommand('カテゴリ'), { action: 'category_view' });
  assert.deepEqual(parseJourneyLineCommand('カテゴリ:IMMIGRATION'), { action: 'category_view', category: 'IMMIGRATION' });
  assert.deepEqual(parseJourneyLineCommand('通知履歴'), { action: 'delivery_history' });
  assert.deepEqual(parseJourneyLineCommand('TODO業者:bank_open'), { action: 'todo_vendor', todoKey: 'bank_open' });
  assert.deepEqual(parseJourneyLineCommand('相談'), { action: 'support_guide' });
});

test('phase741: postback parser resolves task os actions', () => {
  assert.deepEqual(parseJourneyPostbackData('action=next_tasks'), { action: 'next_tasks' });
  assert.deepEqual(parseJourneyPostbackData('action=due_soon_tasks'), { action: 'due_soon_tasks' });
  assert.deepEqual(parseJourneyPostbackData('action=regional_procedures'), { action: 'regional_procedures' });
  assert.deepEqual(parseJourneyPostbackData('action=category_pick&category=HOUSING'), { action: 'category_view', category: 'HOUSING' });
  assert.deepEqual(parseJourneyPostbackData('action=delivery_history'), { action: 'delivery_history' });
  assert.deepEqual(parseJourneyPostbackData('action=todo_vendor&todoKey=visa_docs'), { action: 'todo_vendor', todoKey: 'visa_docs' });
  assert.deepEqual(parseJourneyPostbackData('action=support_guide'), { action: 'support_guide' });
});
