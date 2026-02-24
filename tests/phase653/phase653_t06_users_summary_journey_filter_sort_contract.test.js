'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function loadWithStubbedSummary(summaryItems) {
  const summaryPath = require.resolve('../../src/usecases/admin/getUserOperationalSummary');
  const targetPath = require.resolve('../../src/usecases/phase5/getUsersSummaryFiltered');
  const originalSummary = require.cache[summaryPath];
  const originalTarget = require.cache[targetPath];

  require.cache[summaryPath] = {
    id: summaryPath,
    filename: summaryPath,
    loaded: true,
    exports: {
      getUserOperationalSummary: async () => summaryItems
    }
  };
  delete require.cache[targetPath];
  const loaded = require('../../src/usecases/phase5/getUsersSummaryFiltered');

  function restore() {
    if (originalSummary) require.cache[summaryPath] = originalSummary;
    else delete require.cache[summaryPath];
    if (originalTarget) require.cache[targetPath] = originalTarget;
    else delete require.cache[targetPath];
  }

  return { getUsersSummaryFiltered: loaded.getUsersSummaryFiltered, restore };
}

test('phase653: users summary supports household/journey/todo filters and journey sort keys', async (t) => {
  const rows = [
    {
      lineUserId: 'U_J_1',
      createdAtMs: Date.now() - 86400000,
      hasMemberNumber: true,
      checklistCompleted: 1,
      checklistTotal: 2,
      opsReviewLastReviewedAt: null,
      householdType: 'single',
      journeyStage: 'pre_departure',
      todoOpenCount: 2,
      todoOverdueCount: 0,
      nextTodoDueAt: '2026-03-01T00:00:00.000Z'
    },
    {
      lineUserId: 'U_J_2',
      createdAtMs: Date.now() - 86400000,
      hasMemberNumber: true,
      checklistCompleted: 1,
      checklistTotal: 2,
      opsReviewLastReviewedAt: null,
      householdType: 'couple',
      journeyStage: 'arrived',
      todoOpenCount: 3,
      todoOverdueCount: 2,
      nextTodoDueAt: '2026-02-25T00:00:00.000Z'
    },
    {
      lineUserId: 'U_J_3',
      createdAtMs: Date.now() - 86400000,
      hasMemberNumber: true,
      checklistCompleted: 1,
      checklistTotal: 2,
      opsReviewLastReviewedAt: null,
      householdType: 'accompany1',
      journeyStage: 'arrived',
      todoOpenCount: 0,
      todoOverdueCount: 0,
      nextTodoDueAt: null
    }
  ];

  const { getUsersSummaryFiltered, restore } = loadWithStubbedSummary(rows);
  t.after(() => restore());

  const overdueCouple = await getUsersSummaryFiltered({
    householdType: 'couple',
    journeyStage: 'arrived',
    todoState: 'overdue'
  });
  assert.equal(overdueCouple.length, 1);
  assert.equal(overdueCouple[0].lineUserId, 'U_J_2');

  const sortedByOpen = await getUsersSummaryFiltered({
    sortKey: 'todoOpenCount',
    sortDir: 'desc'
  });
  assert.deepEqual(sortedByOpen.map((item) => item.lineUserId), ['U_J_2', 'U_J_1', 'U_J_3']);

  const todoNone = await getUsersSummaryFiltered({ todoState: 'none' });
  assert.equal(todoNone.length, 1);
  assert.equal(todoNone[0].lineUserId, 'U_J_3');
});

test('phase653: phase5 users-summary route exposes journey filter and sort query params', () => {
  const src = fs.readFileSync('src/routes/phase5Ops.js', 'utf8');
  assert.ok(src.includes("const householdTypeRaw = url.searchParams.get('householdType');"));
  assert.ok(src.includes("const journeyStageRaw = url.searchParams.get('journeyStage');"));
  assert.ok(src.includes("const todoStateRaw = url.searchParams.get('todoState');"));
  assert.ok(src.includes("throw new Error('invalid householdType');"));
  assert.ok(src.includes("throw new Error('invalid journeyStage');"));
  assert.ok(src.includes("throw new Error('invalid todoState');"));
  assert.ok(src.includes("householdType: householdType || 'all'"));
  assert.ok(src.includes("journeyStage: journeyStage || 'all'"));
  assert.ok(src.includes("todoState: todoState || 'all'"));
  assert.ok(src.includes("'nextTodoDueAt'"));
  assert.ok(src.includes("'todoOpenCount'"));
  assert.ok(src.includes("'todoOverdueCount'"));
});
