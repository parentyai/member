'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { handleJourneyLineCommand } = require('../../src/usecases/journey/handleJourneyLineCommand');

function withEnv(key, value) {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  return () => {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  };
}

test('phase707: line todo_list unified view uses task-first dedupe and blockedReason JA translation', async () => {
  const restoreEngine = withEnv('ENABLE_TASK_ENGINE_V1', '1');
  const restoreUnified = withEnv('ENABLE_JOURNEY_UNIFIED_VIEW_V1', '1');

  let todoListCallCount = 0;
  const legacyItems = [
    {
      todoKey: 'legacy_visa',
      title: '旧ビザ準備',
      dueDate: '2026-03-06',
      status: 'open',
      progressState: 'not_started',
      graphStatus: 'actionable',
      meaning: {
        meaningKey: 'visa_precheck',
        title: '旧ビザ準備',
        whyNow: 'legacy duplicate'
      }
    },
    {
      todoKey: 'legacy_housing',
      title: '住居準備',
      dueDate: '2026-03-08',
      status: 'open',
      progressState: 'not_started',
      graphStatus: 'actionable',
      meaning: {
        meaningKey: 'housing_setup',
        title: '住居準備',
        whyNow: '到着後の生活開始に必要'
      }
    }
  ];

  const result = await handleJourneyLineCommand({
    lineUserId: 'U_LINE_707',
    text: 'TODO一覧',
    traceId: 'trace_phase707',
    requestId: 'req_phase707'
  }, {
    tasksRepo: {
      listTasksByUser: async () => [{
        taskId: 'U_LINE_707__rule_visa',
        ruleId: 'rule_visa',
        stepKey: 'visa_precheck',
        dueAt: '2026-03-05T00:00:00.000Z',
        status: 'blocked',
        blockedReason: 'dependency_unmet',
        meaning: {
          meaningKey: 'visa_precheck',
          title: 'ビザ確認',
          whyNow: '渡航遅延の防止'
        }
      }]
    },
    journeyTodoItemsRepo: {
      listJourneyTodoItemsByLineUserId: async () => {
        todoListCallCount += 1;
        if (todoListCallCount === 1) return [];
        return legacyItems;
      },
      patchJourneyTodoItem: async (_lineUserId, _todoKey, patch) => patch
    },
    taskNodesRepo: {
      upsertTaskNodesBulk: async () => ({ ok: true })
    }
  });

  assert.equal(result && result.handled, true);
  assert.match(result.replyText, /\[rule_visa\] ビザ確認/);
  assert.match(result.replyText, /ブロック:前のタスクが未完了/);
  assert.match(result.replyText, /住居準備/);
  assert.equal(result.replyText.includes('旧ビザ準備'), false, 'legacy duplicate should be hidden by meaningKey dedupe');

  restoreEngine();
  restoreUnified();
});
