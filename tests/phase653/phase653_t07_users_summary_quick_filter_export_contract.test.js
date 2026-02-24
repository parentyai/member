'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  maskLineUserId,
  maskMemberNumber,
  toCsv
} = require('../../src/routes/admin/osUsersSummaryExport');
const {
  buildReasonBreakdown,
  buildTopUsers
} = require('../../src/routes/admin/osLlmUsageSummary');

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

test('phase653: users summary quickFilter unknown + tokensToday sort are supported', async (t) => {
  const now = Date.now();
  const base = [
    {
      lineUserId: 'U_OK',
      lastActionAt: new Date(now).toISOString(),
      createdAtMs: now,
      hasMemberNumber: true,
      checklistCompleted: 0,
      checklistTotal: 0,
      opsReviewLastReviewedAt: null,
      plan: 'free',
      subscriptionStatus: 'active',
      billingIntegrityState: 'ok',
      llmUsageToday: 3,
      llmTokenUsedToday: 100,
      llmBlockedRate: 0
    },
    {
      lineUserId: 'U_CONFLICT',
      lastActionAt: new Date(now).toISOString(),
      createdAtMs: now,
      hasMemberNumber: true,
      checklistCompleted: 0,
      checklistTotal: 0,
      opsReviewLastReviewedAt: null,
      plan: 'pro',
      subscriptionStatus: 'active',
      billingIntegrityState: 'conflict',
      llmUsageToday: 4,
      llmTokenUsedToday: 50,
      llmBlockedRate: 0.25
    },
    {
      lineUserId: 'U_UNKNOWN',
      lastActionAt: new Date(now).toISOString(),
      createdAtMs: now,
      hasMemberNumber: true,
      checklistCompleted: 0,
      checklistTotal: 0,
      opsReviewLastReviewedAt: null,
      plan: 'free',
      subscriptionStatus: 'unknown',
      billingIntegrityState: 'unknown',
      llmUsageToday: 1,
      llmTokenUsedToday: 999,
      llmBlockedRate: 1
    }
  ];

  const { getUsersSummaryFiltered, restore } = loadWithStubbedSummary(base);
  t.after(() => restore());

  const unknownOnly = await getUsersSummaryFiltered({ quickFilter: 'unknown' });
  assert.equal(unknownOnly.length, 2);
  assert.ok(unknownOnly.some((row) => row.lineUserId === 'U_CONFLICT'));
  assert.ok(unknownOnly.some((row) => row.lineUserId === 'U_UNKNOWN'));

  const sorted = await getUsersSummaryFiltered({ sortKey: 'tokensToday', sortDir: 'desc' });
  assert.equal(sorted[0].lineUserId, 'U_UNKNOWN');
  assert.equal(sorted[1].lineUserId, 'U_OK');
});

test('phase653: users summary export helpers apply pii mask and csv columns', () => {
  assert.equal(maskLineUserId('U123456789'), 'U12***89');
  assert.equal(maskMemberNumber('12-3456'), '12***56');

  const csv = toCsv([
    {
      lineUserId: 'U123456789',
      memberNumber: '12-3456',
      plan: 'pro',
      subscriptionStatus: 'active',
      billingIntegrityState: 'ok',
      llmUsageToday: 2,
      llmTokenUsedToday: 120,
      llmBlockedToday: 0,
      llmBlockedRate: 0,
      deliveryCount: 10,
      clickCount: 3,
      reactionRate: 0.3,
      categoryLabel: 'A単身',
      statusLabel: '赴任前'
    }
  ]);

  assert.ok(csv.includes('lineUserIdMasked,memberNumberMasked,plan,subscriptionStatus'));
  assert.ok(csv.includes('U12***89'));
  assert.ok(csv.includes('12***56'));
  assert.ok(csv.includes('pro,active,ok'));
});

test('phase653: llm usage summary helpers aggregate block reasons and top users', () => {
  const rows = [
    { userId: 'U1', decision: 'allow', tokenUsed: 10, plan: 'pro' },
    { userId: 'U1', decision: 'blocked', blockedReason: 'budget_exceeded', tokenUsed: 20, plan: 'pro' },
    { userId: 'U2', decision: 'blocked', blockedReason: 'template_violation', tokenUsed: 5, plan: 'free' },
    { userId: 'U2', decision: 'blocked', blockedReason: 'template_violation', tokenUsed: 5, plan: 'free' }
  ];

  const reasons = buildReasonBreakdown(rows);
  assert.equal(reasons[0].reason, 'template_violation');
  assert.equal(reasons[0].count, 2);

  const topUsers = buildTopUsers(rows, 5);
  assert.equal(topUsers.length, 2);
  assert.equal(topUsers[0].userId, 'U1');
  assert.equal(topUsers[0].calls, 2);
  assert.equal(topUsers[0].tokens, 30);
  assert.equal(topUsers[1].blocked, 2);
});
