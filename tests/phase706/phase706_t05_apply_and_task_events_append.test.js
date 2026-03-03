'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { applyTaskRulesForUser } = require('../../src/usecases/tasks/applyTaskRulesForUser');

test('phase706: applyTaskRulesForUser appends task_events when tasks are created', async () => {
  const prevEngine = process.env.ENABLE_TASK_ENGINE_V1;
  const prevEvents = process.env.ENABLE_TASK_EVENTS_V1;
  process.env.ENABLE_TASK_ENGINE_V1 = '1';
  process.env.ENABLE_TASK_EVENTS_V1 = '1';

  const taskEvents = [];

  try {
    const deps = {
      usersRepo: {
        listUsersByMemberNumber: async () => [{ id: 'U_100' }]
      },
      stepRulesRepo: {
        listEnabledStepRulesNow: async () => [{
          ruleId: 'journey_us_v1__onboarding__visa_precheck',
          scenarioKey: 'US_ASSIGNMENT',
          stepKey: 'visa_precheck',
          trigger: { eventKey: 'assignment_created', source: 'admin' },
          leadTime: { kind: 'after', days: 1 },
          dependsOn: [],
          constraints: { quietHours: null, maxActions: null, planLimit: null },
          priority: 100,
          enabled: true,
          riskLevel: 'medium'
        }]
      },
      tasksRepo: {
        listTasksByUser: async () => [],
        upsertTasksBulk: async (tasks) => {
          return (tasks || []).map((task) => Object.assign({}, task, {
            createdAt: task.createdAt || '2026-03-03T00:00:00.000Z',
            updatedAt: '2026-03-03T00:00:00.000Z'
          }));
        }
      },
      journeyTodoItemsRepo: {
        upsertJourneyTodoItem: async () => ({ ok: true })
      },
      eventsRepo: {
        listEventsByUser: async () => [{
          id: 'evt_1',
          eventKey: 'assignment_created',
          source: 'admin',
          occurredAt: '2026-01-01T00:00:00.000Z'
        }]
      },
      deliveriesRepo: {
        listDeliveriesByUser: async () => []
      },
      getKillSwitch: async () => false,
      taskEventsRepo: {
        appendTaskEvent: async (event) => {
          taskEvents.push(event);
          return Object.assign({ id: `task_event_${taskEvents.length}` }, event);
        }
      }
    };

    const result = await applyTaskRulesForUser({
      memberNumber: 'M-100',
      actor: 'phase706_apply'
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.sync.syncedTaskCount, 1);
    assert.equal(result.sync.syncedTodoCount, 1);
    assert.equal(taskEvents.length, 1);
    assert.equal(taskEvents[0].decision, 'created');
  } finally {
    if (prevEngine === undefined) delete process.env.ENABLE_TASK_ENGINE_V1;
    else process.env.ENABLE_TASK_ENGINE_V1 = prevEngine;
    if (prevEvents === undefined) delete process.env.ENABLE_TASK_EVENTS_V1;
    else process.env.ENABLE_TASK_EVENTS_V1 = prevEvents;
  }
});
