'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { getNextBestAction } = require('../../src/usecases/uxos/getNextBestAction');

test('phase742: getNextBestAction returns disabled snapshot when flag is off', async () => {
  const prev = process.env.ENABLE_UXOS_NBA;
  process.env.ENABLE_UXOS_NBA = '0';
  try {
    const result = await getNextBestAction({ lineUserId: 'U742' });
    assert.equal(result.ok, true);
    assert.equal(result.enabled, false);
    assert.equal(result.source, 'disabled');
    assert.equal(result.recommendation, null);
  } finally {
    if (prev === undefined) delete process.env.ENABLE_UXOS_NBA;
    else process.env.ENABLE_UXOS_NBA = prev;
  }
});

test('phase742: getNextBestAction prefers task_engine top candidate in minimal mode', async () => {
  const prevUxos = process.env.ENABLE_UXOS_NBA;
  const prevTask = process.env.ENABLE_TASK_ENGINE_V1;
  const prevNext = process.env.ENABLE_NEXT_TASK_ENGINE_V1;
  const prevCity = process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1;
  process.env.ENABLE_UXOS_NBA = '1';
  process.env.ENABLE_TASK_ENGINE_V1 = '1';
  process.env.ENABLE_NEXT_TASK_ENGINE_V1 = '1';
  process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1 = '0';
  try {
    const result = await getNextBestAction({
      lineUserId: 'U742',
      now: '2026-03-07T00:00:00.000Z'
    }, {
      tasksRepo: {
        async listTasksByUser() {
          return [{
            taskId: 'U742__bank_open',
            userId: 'U742',
            lineUserId: 'U742',
            ruleId: 'bank_open',
            title: '銀行口座を開設',
            status: 'todo',
            dueAt: '2026-03-12T00:00:00.000Z',
            priorityScore: 5
          }];
        }
      },
      stepRulesRepo: {
        async listStepRules() {
          return [{
            ruleId: 'bank_open',
            category: 'BANKING',
            priority: 5
          }];
        }
      }
    });
    assert.equal(result.ok, true);
    assert.equal(result.enabled, true);
    assert.equal(result.source, 'task_engine');
    assert.ok(result.recommendation);
    assert.equal(result.recommendation.action, 'DO_TASK');
    assert.equal(result.recommendation.task.taskId, 'U742__bank_open');
    assert.equal(result.recommendation.task.ruleId, 'bank_open');
  } finally {
    if (prevUxos === undefined) delete process.env.ENABLE_UXOS_NBA;
    else process.env.ENABLE_UXOS_NBA = prevUxos;
    if (prevTask === undefined) delete process.env.ENABLE_TASK_ENGINE_V1;
    else process.env.ENABLE_TASK_ENGINE_V1 = prevTask;
    if (prevNext === undefined) delete process.env.ENABLE_NEXT_TASK_ENGINE_V1;
    else process.env.ENABLE_NEXT_TASK_ENGINE_V1 = prevNext;
    if (prevCity === undefined) delete process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1;
    else process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1 = prevCity;
  }
});
