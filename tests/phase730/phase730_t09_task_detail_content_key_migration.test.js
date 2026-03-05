'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveTaskDetailContentKey } = require('../../src/usecases/journey/taskDetailSectionReply');

test('phase730: resolveTaskDetailContentKey uses task_content_links active mapping', async () => {
  const prevFlag = process.env.ENABLE_TASK_CONTENT_LINK_MIGRATION_V1;
  try {
    process.env.ENABLE_TASK_CONTENT_LINK_MIGRATION_V1 = '1';
    const result = await resolveTaskDetailContentKey({
      lineUserId: 'U_PHASE730_T09',
      todoKey: 'todo_bank_open',
      task: {
        taskId: 'U_PHASE730_T09__rule_bank_open',
        ruleId: 'rule_bank_open'
      }
    }, {
      taskContentLinksRepo: {
        getTaskContentLink: async (ruleId) => {
          if (ruleId !== 'rule_bank_open') return null;
          return {
            ruleId: 'rule_bank_open',
            sourceTaskKey: 'task_bank_open',
            status: 'active',
            confidence: 'manual'
          };
        }
      }
    });

    assert.equal(result.taskKey, 'task_bank_open');
    assert.equal(result.baseTaskKey, 'rule_bank_open');
    assert.equal(result.ruleId, 'rule_bank_open');
    assert.equal(result.source, 'task_content_links.active');
    assert.equal(result.taskContentLink.status, 'active');
  } finally {
    if (prevFlag === undefined) delete process.env.ENABLE_TASK_CONTENT_LINK_MIGRATION_V1;
    else process.env.ENABLE_TASK_CONTENT_LINK_MIGRATION_V1 = prevFlag;
  }
});

test('phase730: resolveTaskDetailContentKey keeps fallback when mapping is warn', async () => {
  const prevFlag = process.env.ENABLE_TASK_CONTENT_LINK_MIGRATION_V1;
  try {
    process.env.ENABLE_TASK_CONTENT_LINK_MIGRATION_V1 = '1';
    const result = await resolveTaskDetailContentKey({
      lineUserId: 'U_PHASE730_T09',
      todoKey: 'todo_bank_open',
      task: {
        taskId: 'U_PHASE730_T09__rule_bank_open',
        ruleId: 'rule_bank_open'
      }
    }, {
      taskContentLinksRepo: {
        getTaskContentLink: async () => ({
          ruleId: 'rule_bank_open',
          sourceTaskKey: 'task_bank_open',
          status: 'warn',
          confidence: 'manual'
        })
      }
    });

    assert.equal(result.taskKey, 'rule_bank_open');
    assert.match(result.source, /task_content_links_warn/);
  } finally {
    if (prevFlag === undefined) delete process.env.ENABLE_TASK_CONTENT_LINK_MIGRATION_V1;
    else process.env.ENABLE_TASK_CONTENT_LINK_MIGRATION_V1 = prevFlag;
  }
});
