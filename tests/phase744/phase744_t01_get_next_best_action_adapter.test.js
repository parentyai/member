'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { getNextBestAction } = require('../../src/usecases/tasks/getNextBestAction');

test('phase744: getNextBestAction does not call computeNextTasks when flag is disabled', async () => {
  const previous = process.env.ENABLE_UXOS_NBA_V1;
  delete process.env.ENABLE_UXOS_NBA_V1;
  let called = false;
  try {
    const result = await getNextBestAction({
      lineUserId: 'U744_1'
    }, {
      computeNextTasks: async () => {
        called = true;
        return { tasks: [] };
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.enabled, false);
    assert.equal(result.authority, 'compute_next_tasks');
    assert.equal(called, false);
  } finally {
    if (previous === undefined) delete process.env.ENABLE_UXOS_NBA_V1;
    else process.env.ENABLE_UXOS_NBA_V1 = previous;
  }
});

test('phase744: getNextBestAction uses computeNextTasks as canonical source', async () => {
  const previous = process.env.ENABLE_UXOS_NBA_V1;
  process.env.ENABLE_UXOS_NBA_V1 = '1';
  let received = null;
  try {
    const result = await getNextBestAction({
      lineUserId: 'U744_2'
    }, {
      computeNextTasks: async (params) => {
        received = params;
        return {
          totalCandidates: 2,
          tasks: [
            { taskId: 'task_1', title: 'First', ruleId: 'rule_1', category: 'LIFE_SETUP', status: 'todo', rank: 1 },
            { taskId: 'task_2', title: 'Second', ruleId: 'rule_2', category: 'LIFE_SETUP', status: 'todo', rank: 2 }
          ]
        };
      }
    });

    assert.equal(received.lineUserId, 'U744_2');
    assert.equal(received.limit, 3);
    assert.equal(result.ok, true);
    assert.equal(result.enabled, true);
    assert.equal(result.authority, 'compute_next_tasks');
    assert.equal(result.totalCandidates, 2);
    assert.equal(result.nextBestAction.taskId, 'task_1');
  } finally {
    if (previous === undefined) delete process.env.ENABLE_UXOS_NBA_V1;
    else process.env.ENABLE_UXOS_NBA_V1 = previous;
  }
});

test('phase744: getNextBestAction returns deterministic fallback when computeNextTasks errors', async () => {
  const previous = process.env.ENABLE_UXOS_NBA_V1;
  process.env.ENABLE_UXOS_NBA_V1 = '1';
  try {
    const result = await getNextBestAction({
      lineUserId: 'U744_3'
    }, {
      computeNextTasks: async () => {
        throw new Error('task engine unavailable');
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.enabled, true);
    assert.equal(result.authority, 'compute_next_tasks');
    assert.equal(result.nextBestAction, null);
    assert.equal(result.fallbackReason, 'task_engine_error');
  } finally {
    if (previous === undefined) delete process.env.ENABLE_UXOS_NBA_V1;
    else process.env.ENABLE_UXOS_NBA_V1 = previous;
  }
});
