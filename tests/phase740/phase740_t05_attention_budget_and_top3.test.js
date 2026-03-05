'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { computeDailyTopTasks } = require('../../src/usecases/tasks/computeDailyTopTasks');
const { computeAttentionBudget } = require('../../src/usecases/notifications/computeAttentionBudget');

test('phase740: computeDailyTopTasks selects deterministic top3 by priority/deadline/dependency', () => {
  const tasks = [
    { taskId: 't1', priorityScore: 500, dueAt: '2026-03-20T00:00:00.000Z', status: 'todo' },
    { taskId: 't2', priorityScore: 10, dueAt: '2026-03-06T00:00:00.000Z', status: 'todo' },
    { taskId: 't3', priorityScore: 120, dueAt: '2026-03-05T08:00:00.000Z', status: 'doing' },
    { taskId: 't4', priorityScore: 5, dueAt: '2026-04-01T00:00:00.000Z', status: 'todo', blockedReason: 'dependency' }
  ];
  const top = computeDailyTopTasks({
    tasks,
    limit: 3,
    now: '2026-03-05T00:00:00.000Z'
  });
  assert.equal(top.length, 3);
  assert.deepEqual(top.map((item) => item.taskId), ['t3', 't2', 't1']);
  assert.ok(top[0].score >= top[1].score);
});

test('phase740: computeAttentionBudget uses timezone day window and remaining slots', async () => {
  const budget = await computeAttentionBudget({
    lineUserId: 'U_BUDGET',
    timezone: 'America/New_York',
    now: '2026-03-05T12:00:00.000Z',
    maxPerDay: 3
  }, {
    deliveriesRepo: {
      countDeliveredByUserSince: async (lineUserId, sinceAt) => {
        assert.equal(lineUserId, 'U_BUDGET');
        assert.ok(String(sinceAt).includes('T'));
        return 2;
      }
    }
  });
  assert.equal(budget.maxPerDay, 3);
  assert.equal(budget.usedCount, 2);
  assert.equal(budget.remainingCount, 1);
  assert.equal(budget.timezone, 'America/New_York');
});
