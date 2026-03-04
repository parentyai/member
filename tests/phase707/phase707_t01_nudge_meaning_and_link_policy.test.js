'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runTaskNudgeJob } = require('../../src/usecases/tasks/runTaskNudgeJob');

function withEnv(key, value) {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  return () => {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  };
}

test('phase707: runTaskNudgeJob uses meaning-first copy and lenient link fallback in dry-run', async () => {
  const restoreNudge = withEnv('ENABLE_TASK_NUDGE_V1', '1');
  const restorePolicy = withEnv('TASK_NUDGE_LINK_POLICY', 'lenient');
  const restoreLink = withEnv('TASK_NUDGE_LINK_REGISTRY_ID', '');

  try {
    const result = await runTaskNudgeJob({
      dryRun: true,
      now: '2026-03-03T09:00:00.000Z'
    }, {
      tasksRepo: {
        listDueTasks: async () => [{
          taskId: 'U_PHASE707__rule_1',
          userId: 'U_PHASE707',
          lineUserId: 'U_PHASE707',
          ruleId: 'rule_1',
          stepKey: 'step_1',
          status: 'todo',
          dueAt: '2026-03-05T00:00:00.000Z',
          nextNudgeAt: '2026-03-03T00:00:00.000Z',
          meaning: {
            meaningKey: 'visa_precheck',
            title: 'ビザ要件の再確認',
            whyNow: '差戻し防止のため期限前に確認が必要',
            doneDefinition: '必要書類の期限と不足有無を確認済みにする',
            helpLinkRegistryIds: []
          }
        }]
      },
      stepRulesRepo: {
        getStepRule: async () => ({
          ruleId: 'rule_1',
          updatedAt: '2026-03-01T00:00:00.000Z',
          nudgeTemplate: {}
        })
      },
      getKillSwitch: async () => false,
      getNotificationCaps: async () => ({})
    });

    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].status, 'dry_run');

    const notificationPayload = result.results[0].notificationPayload;
    assert.ok(notificationPayload);
    assert.equal(notificationPayload.linkRegistryId, 'task_todo_list');
    assert.match(notificationPayload.title, /【やること】ビザ要件の再確認/);
    assert.match(notificationPayload.body, /理由: 差戻し防止のため期限前に確認が必要/);
    assert.match(notificationPayload.body, /具体ステップ: 必要書類の期限と不足有無を確認済みにする/);
  } finally {
    restoreNudge();
    restorePolicy();
    restoreLink();
  }
});

test('phase707: runTaskNudgeJob suppresses link-missing when strict policy is enabled', async () => {
  const restoreNudge = withEnv('ENABLE_TASK_NUDGE_V1', '1');
  const restorePolicy = withEnv('TASK_NUDGE_LINK_POLICY', 'strict');
  const restoreLink = withEnv('TASK_NUDGE_LINK_REGISTRY_ID', '');

  try {
    const result = await runTaskNudgeJob({
      dryRun: true,
      now: '2026-03-03T09:00:00.000Z'
    }, {
      tasksRepo: {
        listDueTasks: async () => [{
          taskId: 'U_PHASE707__rule_2',
          userId: 'U_PHASE707',
          lineUserId: 'U_PHASE707',
          ruleId: 'rule_2',
          stepKey: 'step_2',
          status: 'todo',
          dueAt: '2026-03-05T00:00:00.000Z',
          nextNudgeAt: '2026-03-03T00:00:00.000Z'
        }]
      },
      stepRulesRepo: {
        getStepRule: async () => ({
          ruleId: 'rule_2',
          updatedAt: '2026-03-01T00:00:00.000Z',
          nudgeTemplate: {}
        })
      },
      getKillSwitch: async () => false,
      getNotificationCaps: async () => ({})
    });

    assert.equal(result.ok, true);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].status, 'skipped');
    assert.equal(result.results[0].reason, 'link_registry_missing');
  } finally {
    restoreNudge();
    restorePolicy();
    restoreLink();
  }
});
