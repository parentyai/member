'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleJourneyLineCommand } = require('../../src/usecases/journey/handleJourneyLineCommand');

function createDeps() {
  return {
    tasksRepo: {
      getTask: async () => null,
      listTasksByUser: async () => ([
        {
          taskId: 'U_PHASE748__imm_visa',
          ruleId: 'imm_visa',
          status: 'todo',
          dueAt: '2026-03-07T00:00:00.000Z',
          meaning: { title: 'ビザ書類準備' },
          blockedReason: '住所証明待ち'
        },
        {
          taskId: 'U_PHASE748__bank_open',
          ruleId: 'bank_open',
          status: 'doing',
          dueAt: '2026-03-09T00:00:00.000Z',
          meaning: { title: '銀行口座を作る' }
        }
      ])
    },
    stepRulesRepo: {
      listStepRules: async () => ([
        { ruleId: 'imm_visa', category: 'IMMIGRATION', priority: 5 },
        { ruleId: 'bank_open', category: 'BANKING', priority: 8 }
      ])
    },
    deliveriesRepo: {
      listDeliveriesByUser: async () => ([])
    }
  };
}

test('phase748: due_soon command renders due and overdue sections without exposing internal token', async () => {
  const prevTaskEngine = process.env.ENABLE_TASK_ENGINE_V1;
  const prevEntry = process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1;
  const prevNext = process.env.ENABLE_NEXT_TASK_ENGINE_V1;
  const prevCity = process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1;
  process.env.ENABLE_TASK_ENGINE_V1 = '1';
  process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1 = '1';
  process.env.ENABLE_NEXT_TASK_ENGINE_V1 = '1';
  process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1 = '0';
  try {
    const deps = createDeps();
    const due = await handleJourneyLineCommand({
      lineUserId: 'U_PHASE748',
      text: '今週の期限',
      now: '2026-03-08T00:00:00.000Z'
    }, deps);
    assert.equal(due.handled, true);
    assert.match(due.replyText, /期限のある未完了タスク/);
    assert.match(due.replyText, /期限（7日以内）/);
    assert.match(due.replyText, /期限超過/);
    assert.doesNotMatch(due.replyText, /DUE_SOON|due_soon/i);

    const next = await handleJourneyLineCommand({ lineUserId: 'U_PHASE748', text: '今日の3つ' }, deps);
    assert.equal(next.handled, true);
    assert.match(next.replyText, /ブロッカー:住所証明待ち/);

    const categorySummary = await handleJourneyLineCommand({ lineUserId: 'U_PHASE748', text: 'カテゴリ' }, deps);
    assert.equal(categorySummary.handled, true);
    assert.match(categorySummary.replyText, /ブロック:1件/);

    const categoryFiltered = await handleJourneyLineCommand({ lineUserId: 'U_PHASE748', text: 'カテゴリ:IMMIGRATION' }, deps);
    assert.equal(categoryFiltered.handled, true);
    assert.match(categoryFiltered.replyText, /ブロッカー:住所証明待ち/);

    const support = await handleJourneyLineCommand({ lineUserId: 'U_PHASE748', text: '相談' }, deps);
    assert.equal(support.handled, true);
    assert.match(support.replyText, /案内表示 \+ 利用イベント記録/);
    assert.match(support.replyText, /チケット作成は行いません/);
  } finally {
    if (prevTaskEngine === undefined) delete process.env.ENABLE_TASK_ENGINE_V1;
    else process.env.ENABLE_TASK_ENGINE_V1 = prevTaskEngine;
    if (prevEntry === undefined) delete process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1;
    else process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1 = prevEntry;
    if (prevNext === undefined) delete process.env.ENABLE_NEXT_TASK_ENGINE_V1;
    else process.env.ENABLE_NEXT_TASK_ENGINE_V1 = prevNext;
    if (prevCity === undefined) delete process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1;
    else process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1 = prevCity;
  }
});
