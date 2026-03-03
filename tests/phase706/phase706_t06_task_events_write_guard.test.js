'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runTaskNudgeJob } = require('../../src/usecases/tasks/runTaskNudgeJob');
const { patchTaskState } = require('../../src/usecases/tasks/patchTaskState');

test('phase706: runTaskNudgeJob dry-run does not write task patches or task_events', async () => {
  const prevNudge = process.env.ENABLE_TASK_NUDGE_V1;
  const prevEvents = process.env.ENABLE_TASK_EVENTS_V1;
  process.env.ENABLE_TASK_NUDGE_V1 = '1';
  process.env.ENABLE_TASK_EVENTS_V1 = '1';

  let patchCount = 0;
  let eventCount = 0;

  try {
    const result = await runTaskNudgeJob({
      dryRun: true,
      now: '2026-03-03T00:00:00.000Z',
      actor: 'phase706_dryrun'
    }, {
      tasksRepo: {
        listDueTasks: async () => [{
          taskId: 'U_1__rule_1',
          userId: 'U_1',
          lineUserId: 'U_1',
          ruleId: 'rule_1',
          stepKey: 'step_1',
          status: 'todo',
          dueAt: '2026-03-01T00:00:00.000Z',
          nextNudgeAt: '2026-03-01T00:00:00.000Z'
        }],
        patchTask: async () => {
          patchCount += 1;
          return null;
        }
      },
      stepRulesRepo: {
        getStepRule: async () => ({
          ruleId: 'rule_1',
          updatedAt: '2026-03-01T00:00:00.000Z',
          nudgeTemplate: {
            linkRegistryId: 'task_todo_list',
            ctaText: 'open',
            notificationCategory: 'SEQUENCE_GUIDANCE'
          }
        })
      },
      taskEventsRepo: {
        appendTaskEvent: async () => {
          eventCount += 1;
          return { id: `evt_${eventCount}` };
        }
      },
      getKillSwitch: async () => false,
      getNotificationCaps: async () => ({})
    });

    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.equal(patchCount, 0);
    assert.equal(eventCount, 0);
  } finally {
    if (prevNudge === undefined) delete process.env.ENABLE_TASK_NUDGE_V1;
    else process.env.ENABLE_TASK_NUDGE_V1 = prevNudge;
    if (prevEvents === undefined) delete process.env.ENABLE_TASK_EVENTS_V1;
    else process.env.ENABLE_TASK_EVENTS_V1 = prevEvents;
  }
});

test('phase706: patchTaskState appends task_events when status changes', async () => {
  const prevEvents = process.env.ENABLE_TASK_EVENTS_V1;
  process.env.ENABLE_TASK_EVENTS_V1 = '1';
  const events = [];

  try {
    const result = await patchTaskState({
      userId: 'U_PATCH',
      taskId: 'U_PATCH__rule_1',
      action: 'done',
      now: '2026-03-03T00:00:00.000Z',
      actor: 'phase706_patch'
    }, {
      tasksRepo: {
        getTask: async () => ({
          taskId: 'U_PATCH__rule_1',
          userId: 'U_PATCH',
          lineUserId: 'U_PATCH',
          ruleId: 'rule_1',
          status: 'todo',
          dueAt: '2026-03-10T00:00:00.000Z',
          nextNudgeAt: '2026-03-05T00:00:00.000Z',
          blockedReason: null
        }),
        patchTask: async (_taskId, patch) => ({
          taskId: 'U_PATCH__rule_1',
          userId: 'U_PATCH',
          lineUserId: 'U_PATCH',
          ruleId: 'rule_1',
          status: patch.status,
          dueAt: '2026-03-10T00:00:00.000Z',
          nextNudgeAt: patch.nextNudgeAt,
          blockedReason: patch.blockedReason,
          checkedAt: patch.checkedAt
        })
      },
      journeyTodoItemsRepo: {
        upsertJourneyTodoItem: async () => ({ ok: true })
      },
      taskEventsRepo: {
        appendTaskEvent: async (event) => {
          events.push(event);
          return Object.assign({ id: `evt_${events.length}` }, event);
        }
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.task.status, 'done');
    assert.equal(events.length, 1);
    assert.equal(events[0].decision, 'status_changed');
    assert.equal(events[0].beforeStatus, 'todo');
    assert.equal(events[0].afterStatus, 'done');
  } finally {
    if (prevEvents === undefined) delete process.env.ENABLE_TASK_EVENTS_V1;
    else process.env.ENABLE_TASK_EVENTS_V1 = prevEvents;
  }
});
