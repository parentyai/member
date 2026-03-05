'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { planTaskContentLinkMigration } = require('../../src/usecases/tasks/planTaskContentLinkMigration');
const { applyTaskContentLinkMigration } = require('../../src/usecases/tasks/applyTaskContentLinkMigration');

test('phase730: task-content link migration plan resolves strict + manual and leaves unlinked as warning', async () => {
  const plan = await planTaskContentLinkMigration({
    manualMappings: [{ sourceTaskKey: 'legacy_bank_open', ruleId: 'rule_bank_open', note: 'manual_map' }]
  }, {
    stepRulesRepo: {
      listStepRules: async () => [
        { ruleId: 'rule_bank_open' },
        { ruleId: 'rule_credit_card' }
      ]
    },
    taskContentsRepo: {
      listTaskContents: async () => [
        { taskKey: 'rule_credit_card', title: 'カード作成' },
        { taskKey: 'legacy_bank_open', title: '口座開設' },
        { taskKey: 'unmapped_key', title: '未連結' }
      ]
    },
    taskContentLinksRepo: {
      listTaskContentLinks: async () => []
    }
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.summary.linkedCount, 2);
  assert.equal(plan.summary.unlinkedCount, 1);
  assert.equal(plan.summary.manualMapCount, 1);
  assert.ok(plan.linked.some((row) => row.taskKey === 'rule_credit_card' && row.reason === 'strict_exact'));
  assert.ok(plan.linked.some((row) => row.taskKey === 'legacy_bank_open' && row.reason === 'manual_map'));
  assert.ok(plan.unlinked.some((row) => row.taskKey === 'unmapped_key'));
});

test('phase730: task-content link migration apply is flag-guarded and add-only upserts when enabled', async () => {
  const prevApply = process.env.ENABLE_TASK_CONTENT_LINK_MIGRATION_APPLY_V1;
  const savedRows = [];
  const deps = {
    stepRulesRepo: {
      listStepRules: async () => [{ ruleId: 'rule_bank_open' }]
    },
    taskContentsRepo: {
      listTaskContents: async () => [{ taskKey: 'rule_bank_open', title: '口座開設' }]
    },
    taskContentLinksRepo: {
      listTaskContentLinks: async () => [],
      upsertTaskContentLink: async (ruleId, patch) => {
        const row = Object.assign({ id: ruleId }, patch);
        savedRows.push(row);
        return row;
      }
    },
    appendAuditLog: async () => ({ ok: true })
  };

  try {
    process.env.ENABLE_TASK_CONTENT_LINK_MIGRATION_APPLY_V1 = '0';
    await assert.rejects(
      () => applyTaskContentLinkMigration({ actor: 'phase730_t08' }, deps),
      (err) => err && err.code === 'task_content_link_migration_apply_disabled'
    );

    process.env.ENABLE_TASK_CONTENT_LINK_MIGRATION_APPLY_V1 = '1';
    const applied = await applyTaskContentLinkMigration({
      actor: 'phase730_t08',
      migrationTraceId: 'trace_phase730_t08'
    }, deps);
    assert.equal(applied.ok, true);
    assert.equal(applied.summary.linkedCount, 1);
    assert.equal(applied.summary.savedCount, 1);
    assert.equal(savedRows.length, 1);
    assert.equal(savedRows[0].ruleId, 'rule_bank_open');
    assert.equal(savedRows[0].sourceTaskKey, 'rule_bank_open');
  } finally {
    if (prevApply === undefined) delete process.env.ENABLE_TASK_CONTENT_LINK_MIGRATION_APPLY_V1;
    else process.env.ENABLE_TASK_CONTENT_LINK_MIGRATION_APPLY_V1 = prevApply;
  }
});
