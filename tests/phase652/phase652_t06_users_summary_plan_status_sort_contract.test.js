'use strict';

const assert = require('node:assert/strict');
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

test('phase652: users summary supports plan/subscription filters and llmUsage sort', async (t) => {
  const now = Date.now();
  const base = [
    {
      lineUserId: 'U_PRO_HIGH',
      lastActionAt: new Date(now).toISOString(),
      createdAtMs: now - 86400000,
      hasMemberNumber: true,
      checklistCompleted: 0,
      checklistTotal: 0,
      opsReviewLastReviewedAt: null,
      plan: 'pro',
      subscriptionStatus: 'trialing',
      llmUsage: 12
    },
    {
      lineUserId: 'U_PRO_LOW',
      lastActionAt: new Date(now).toISOString(),
      createdAtMs: now - 86400000,
      hasMemberNumber: true,
      checklistCompleted: 0,
      checklistTotal: 0,
      opsReviewLastReviewedAt: null,
      plan: 'pro',
      subscriptionStatus: 'active',
      llmUsage: 3
    },
    {
      lineUserId: 'U_FREE',
      lastActionAt: new Date(now).toISOString(),
      createdAtMs: now - 86400000,
      hasMemberNumber: true,
      checklistCompleted: 0,
      checklistTotal: 0,
      opsReviewLastReviewedAt: null,
      plan: 'free',
      subscriptionStatus: 'past_due',
      llmUsage: 99
    }
  ];

  const { getUsersSummaryFiltered, restore } = loadWithStubbedSummary(base);
  t.after(() => restore());

  const proSorted = await getUsersSummaryFiltered({
    plan: 'pro',
    sortKey: 'llmUsage',
    sortDir: 'desc'
  });
  assert.equal(proSorted.length, 2);
  assert.equal(proSorted[0].lineUserId, 'U_PRO_HIGH');
  assert.equal(proSorted[1].lineUserId, 'U_PRO_LOW');

  const filteredStatus = await getUsersSummaryFiltered({
    plan: 'free',
    subscriptionStatus: 'past_due'
  });
  assert.equal(filteredStatus.length, 1);
  assert.equal(filteredStatus[0].lineUserId, 'U_FREE');
});
