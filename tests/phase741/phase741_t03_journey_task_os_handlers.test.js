'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleJourneyLineCommand } = require('../../src/usecases/journey/handleJourneyLineCommand');

function createDeps() {
  return {
    tasksRepo: {
      getTask: async (taskId) => {
        if (taskId === 'U_PHASE741__bank_open') {
          return {
            taskId,
            ruleId: 'bank_open',
            meaning: { title: '銀行口座を作る' },
            status: 'todo',
            dueAt: '2026-03-09T00:00:00.000Z'
          };
        }
        return null;
      },
      listTasksByUser: async () => ([
        {
          taskId: 'U_PHASE741__imm_visa',
          ruleId: 'imm_visa',
          status: 'todo',
          dueAt: '2026-03-07T00:00:00.000Z',
          meaning: { title: 'ビザ書類準備' },
          blockedReason: '住所証明待ち'
        },
        {
          taskId: 'U_PHASE741__bank_open',
          ruleId: 'bank_open',
          status: 'doing',
          dueAt: '2026-03-09T00:00:00.000Z',
          meaning: { title: '銀行口座を作る' }
        }
      ])
    },
    stepRulesRepo: {
      listStepRules: async () => ([
        { ruleId: 'imm_visa', category: 'IMMIGRATION', priority: 5, recommendedVendorLinkIds: [] },
        { ruleId: 'bank_open', category: 'BANKING', priority: 8, recommendedVendorLinkIds: ['vendor_bank'] }
      ]),
      getStepRule: async (ruleId) => {
        if (ruleId === 'bank_open') return { ruleId, recommendedVendorLinkIds: ['vendor_bank'] };
        return null;
      }
    },
    taskContentsRepo: {
      getTaskContent: async (taskKey) => {
        if (taskKey !== 'bank_open') return null;
        return {
          taskKey,
          recommendedVendorLinkIds: ['vendor_bank']
        };
      }
    },
    linkRegistryRepo: {
      getLink: async (id) => {
        if (id === 'vendor_bank') {
          return {
            id,
            title: 'US Bank',
            url: 'https://example.com/us-bank',
            enabled: true,
            lastHealth: { state: 'OK' }
          };
        }
        return null;
      }
    },
    deliveriesRepo: {
      listDeliveriesByUser: async () => ([
        {
          id: 'd1',
          notificationId: 'n1',
          state: 'delivered',
          notificationCategory: 'TASK_NUDGE',
          sentAt: '2026-03-05T01:20:00.000Z',
          delivered: true
        }
      ])
    },
    usersRepo: {
      getUser: async () => ({ regionKey: 'us-ca-sanfrancisco' })
    },
    userCityPackPreferencesRepo: {
      getUserCityPackPreference: async () => ({ modulesSubscribed: [] })
    },
    composeCityAndNationwidePacks: async () => ({ items: [] }),
    cityPacksRepo: {
      getCityPack: async () => null
    }
  };
}

test('phase741: journey command handlers cover next/category/history/vendor/support', async () => {
  const prevTaskEngine = process.env.ENABLE_TASK_ENGINE_V1;
  const prevEntry = process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1;
  const prevNext = process.env.ENABLE_NEXT_TASK_ENGINE_V1;
  const prevCity = process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1;
  const prevRegional = process.env.ENABLE_JOURNEY_REGIONAL_PROCEDURES_V1;
  process.env.ENABLE_TASK_ENGINE_V1 = '1';
  process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1 = '1';
  process.env.ENABLE_NEXT_TASK_ENGINE_V1 = '1';
  process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1 = '0';
  process.env.ENABLE_JOURNEY_REGIONAL_PROCEDURES_V1 = '1';
  try {
    const deps = createDeps();

    const next = await handleJourneyLineCommand({ lineUserId: 'U_PHASE741', text: '今日の3つ' }, deps);
    assert.equal(next.handled, true);
    assert.match(next.replyText, /今日の3つ/);
    assert.match(next.replyText, /ブロッカー:住所証明待ち/);

    const dueSoon = await handleJourneyLineCommand({
      lineUserId: 'U_PHASE741',
      text: '今週の期限',
      now: '2026-03-08T00:00:00.000Z'
    }, deps);
    assert.equal(dueSoon.handled, true);
    assert.match(dueSoon.replyText, /期限（7日以内）/);
    assert.match(dueSoon.replyText, /期限超過/);

    const regional = await handleJourneyLineCommand({
      lineUserId: 'U_PHASE741',
      text: '地域手続き',
      now: '2026-03-03T00:00:00.000Z'
    }, deps);
    assert.equal(regional.handled, true);
    assert.match(regional.replyText, /地域手続き（us-ca-sanfrancisco）/);

    const categorySummary = await handleJourneyLineCommand({ lineUserId: 'U_PHASE741', text: 'カテゴリ' }, deps);
    assert.equal(categorySummary.handled, true);
    assert.match(categorySummary.replyText, /ブロック:1件/);

    const category = await handleJourneyLineCommand({ lineUserId: 'U_PHASE741', text: 'カテゴリ:BANKING' }, deps);
    assert.equal(category.handled, true);
    assert.match(category.replyText, /カテゴリ:BANKING/);

    const history = await handleJourneyLineCommand({ lineUserId: 'U_PHASE741', text: '通知履歴' }, deps);
    assert.equal(history.handled, true);
    assert.match(history.replyText, /直近の通知履歴/);

    const vendor = await handleJourneyLineCommand({ lineUserId: 'U_PHASE741', text: 'TODO業者:bank_open' }, deps);
    assert.equal(vendor.handled, true);
    assert.match(vendor.replyText, /US Bank/);

    const support = await handleJourneyLineCommand({ lineUserId: 'U_PHASE741', text: '相談' }, deps);
    assert.equal(support.handled, true);
    assert.match(support.replyText, /案内表示/);

    const depsWithoutRegion = createDeps();
    depsWithoutRegion.usersRepo = {
      getUser: async () => ({})
    };
    const regionalWithoutRegion = await handleJourneyLineCommand({
      lineUserId: 'U_PHASE741',
      text: '地域手続き',
      now: '2026-03-03T00:00:00.000Z'
    }, depsWithoutRegion);
    assert.equal(regionalWithoutRegion.handled, true);
    assert.match(regionalWithoutRegion.replyText, /地域手続きは地域設定後に有効になります/);
  } finally {
    if (prevTaskEngine === undefined) delete process.env.ENABLE_TASK_ENGINE_V1;
    else process.env.ENABLE_TASK_ENGINE_V1 = prevTaskEngine;
    if (prevEntry === undefined) delete process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1;
    else process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1 = prevEntry;
    if (prevNext === undefined) delete process.env.ENABLE_NEXT_TASK_ENGINE_V1;
    else process.env.ENABLE_NEXT_TASK_ENGINE_V1 = prevNext;
    if (prevCity === undefined) delete process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1;
    else process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1 = prevCity;
    if (prevRegional === undefined) delete process.env.ENABLE_JOURNEY_REGIONAL_PROCEDURES_V1;
    else process.env.ENABLE_JOURNEY_REGIONAL_PROCEDURES_V1 = prevRegional;
  }
});
