'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { computeTaskGraph } = require('../../src/usecases/tasks/computeTaskGraph');
const { computeNextTasks } = require('../../src/usecases/tasks/computeNextTasks');

test('phase741: computeTaskGraph detects cycle and dependency limit warnings', () => {
  const prevMax = process.env.TASK_DEPENDENCY_MAX;
  process.env.TASK_DEPENDENCY_MAX = '10';
  try {
    const cycle = computeTaskGraph({
      todoItems: [
        { todoKey: 'a', dependsOn: ['b'] },
        { todoKey: 'b', dependsOn: ['a'] }
      ]
    });
    assert.equal(cycle.ok, false);
    assert.equal(cycle.cycleCount, 1);

    const warnings = computeTaskGraph({
      todoItems: [{ todoKey: 'x', dependsOn: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10', 'd11'] }]
    });
    assert.equal(warnings.ok, true);
    assert.match(warnings.warnings.join('\n'), /dependsOn exceeds max 10/);
  } finally {
    if (prevMax === undefined) delete process.env.TASK_DEPENDENCY_MAX;
    else process.env.TASK_DEPENDENCY_MAX = prevMax;
  }
});

test('phase741: computeNextTasks returns deterministic top3 with category filter', async () => {
  const prevEngine = process.env.ENABLE_NEXT_TASK_ENGINE_V1;
  const prevTaskEngine = process.env.ENABLE_TASK_ENGINE_V1;
  const prevCityPack = process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1;
  process.env.ENABLE_NEXT_TASK_ENGINE_V1 = '1';
  process.env.ENABLE_TASK_ENGINE_V1 = '1';
  process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1 = '0';
  try {
    const tasks = [
      { taskId: 'U1__imm_visa', ruleId: 'imm_visa', status: 'todo', dueAt: '2026-03-06T00:00:00.000Z' },
      { taskId: 'U1__house_lease', ruleId: 'house_lease', status: 'todo', dueAt: '2026-03-10T00:00:00.000Z' },
      { taskId: 'U1__bank_open', ruleId: 'bank_open', status: 'doing', dueAt: '2026-03-08T00:00:00.000Z' },
      { taskId: 'U1__done_task', ruleId: 'done_task', status: 'done', dueAt: '2026-03-07T00:00:00.000Z' }
    ];
    const stepRules = [
      { ruleId: 'imm_visa', category: 'IMMIGRATION', priority: 5 },
      { ruleId: 'house_lease', category: 'HOUSING', priority: 20 },
      { ruleId: 'bank_open', category: 'BANKING', priority: 8 },
      { ruleId: 'done_task', category: 'LIFE_SETUP', priority: 1 }
    ];

    const result = await computeNextTasks({
      lineUserId: 'U1',
      tasks,
      stepRules,
      now: '2026-03-05T00:00:00.000Z'
    }, {});

    assert.equal(result.ok, true);
    assert.equal(result.tasks.length, 3);
    assert.deepEqual(result.tasks.map((item) => item.ruleId), ['bank_open', 'imm_visa', 'house_lease']);

    const filtered = await computeNextTasks({
      lineUserId: 'U1',
      tasks,
      stepRules,
      category: 'BANKING',
      now: '2026-03-05T00:00:00.000Z'
    }, {});
    assert.equal(filtered.tasks.length, 1);
    assert.equal(filtered.tasks[0].ruleId, 'bank_open');
  } finally {
    if (prevEngine === undefined) delete process.env.ENABLE_NEXT_TASK_ENGINE_V1;
    else process.env.ENABLE_NEXT_TASK_ENGINE_V1 = prevEngine;
    if (prevTaskEngine === undefined) delete process.env.ENABLE_TASK_ENGINE_V1;
    else process.env.ENABLE_TASK_ENGINE_V1 = prevTaskEngine;
    if (prevCityPack === undefined) delete process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1;
    else process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1 = prevCityPack;
  }
});
