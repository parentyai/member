'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  parseJourneyLineCommand,
  parseJourneyPostbackData
} = require('../../src/domain/journey/lineCommandParsers');

function loadPostbackWithLineStub(handler) {
  const postbackPath = require.resolve('../../src/usecases/journey/handleJourneyPostback');
  const lineCommandPath = require.resolve('../../src/usecases/journey/handleJourneyLineCommand');
  const previousPostback = require.cache[postbackPath];
  const previousLineCommand = require.cache[lineCommandPath];

  const previousLineExports = previousLineCommand && previousLineCommand.exports
    ? previousLineCommand.exports
    : {};
  const stubLineCommandModule = Object.assign({}, previousLineExports, {
    handleJourneyLineCommand: async (params, deps) => handler(params, deps)
  });

  require.cache[lineCommandPath] = {
    id: lineCommandPath,
    filename: lineCommandPath,
    loaded: true,
    exports: stubLineCommandModule
  };
  delete require.cache[postbackPath];
  const loaded = require('../../src/usecases/journey/handleJourneyPostback');

  return {
    handleJourneyPostback: loaded.handleJourneyPostback,
    restore() {
      delete require.cache[postbackPath];
      if (previousPostback) require.cache[postbackPath] = previousPostback;
      else delete require.cache[postbackPath];

      if (previousLineCommand) require.cache[lineCommandPath] = previousLineCommand;
      else delete require.cache[lineCommandPath];
    }
  };
}

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

test('phase741: parser rejects invalid calendar date and keeps leap-day valid', () => {
  assert.deepEqual(parseJourneyLineCommand('渡航日:2026-02-31'), { action: 'invalid_departure_date' });
  assert.deepEqual(parseJourneyLineCommand('着任日:2024-02-29'), { action: 'set_assignment_date', assignmentDate: '2024-02-29' });
});

test('phase741: postback actions due_soon_tasks and regional_procedures map to command text', async () => {
  const texts = [];
  const { handleJourneyPostback, restore } = loadPostbackWithLineStub((params) => {
    texts.push(params && params.text);
    return { handled: true, replyText: `OK:${params.text}` };
  });
  try {
    const dueSoon = await handleJourneyPostback({ lineUserId: 'U_PHASE741', data: 'action=due_soon_tasks' });
    assert.equal(dueSoon.handled, true);
    assert.equal(texts.shift(), '今週の期限');
    assert.equal(dueSoon.replyText, 'OK:今週の期限');

    const regional = await handleJourneyPostback({ lineUserId: 'U_PHASE741', data: 'action=regional_procedures' });
    assert.equal(regional.handled, true);
    assert.equal(texts.shift(), '地域手続き');
    assert.equal(regional.replyText, 'OK:地域手続き');
  } finally {
    restore();
  }
});

test('phase741: postback missing todo_detail and todo_detail_section actions return friendly handled replies', async () => {
  const called = [];
  const { handleJourneyPostback, restore } = loadPostbackWithLineStub((params) => {
    called.push(params.text);
    return { handled: false, replyText: 'unexpected' };
  });
  try {
    const missingTodoDetail = await handleJourneyPostback({ lineUserId: 'U_PHASE741', data: 'action=todo_detail' });
    assert.equal(missingTodoDetail.handled, true);
    assert.match(missingTodoDetail.replyText, /TODO詳細/);

    const missingTodoSection = await handleJourneyPostback({
      lineUserId: 'U_PHASE741',
      data: 'action=todo_detail_section&todoKey=bank_open&section=invalid'
    });
    assert.equal(missingTodoSection.handled, true);
    assert.match(missingTodoSection.replyText, /TODO詳細/);
    assert.equal(called.length, 0);
  } finally {
    restore();
  }
});
