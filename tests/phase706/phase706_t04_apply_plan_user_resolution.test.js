'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { planTaskRulesApply } = require('../../src/usecases/tasks/planTaskRulesApply');

test('phase706: planTaskRulesApply returns 409 when memberNumber resolves to multiple users', async () => {
  await assert.rejects(
    () => planTaskRulesApply({ memberNumber: 'M-001' }, {
      usersRepo: {
        listUsersByMemberNumber: async () => [{ id: 'U_1' }, { id: 'U_2' }]
      }
    }),
    (err) => {
      assert.equal(err && err.code, 'multiple_users');
      assert.equal(err && err.statusCode, 409);
      assert.deepEqual(err && err.details && err.details.resolvedUsers, ['U_1', 'U_2']);
      return true;
    }
  );
});

test('phase706: planTaskRulesApply resolves single user and computes deterministic planHash', async () => {
  const deps = {
    usersRepo: {
      listUsersByMemberNumber: async () => [{ id: 'U_3' }]
    },
    stepRulesRepo: {
      listEnabledStepRulesNow: async () => []
    },
    tasksRepo: {
      listTasksByUser: async () => []
    },
    eventsRepo: {
      listEventsByUser: async () => []
    },
    deliveriesRepo: {
      listDeliveriesByUser: async () => []
    },
    getKillSwitch: async () => false
  };

  const first = await planTaskRulesApply({ memberNumber: 'M-001', now: '2026-03-03T09:00:00.000Z' }, deps);
  const second = await planTaskRulesApply({ memberNumber: 'M-001', now: '2026-03-03T09:00:00.000Z' }, deps);

  assert.equal(first.ok, true);
  assert.equal(first.lineUserId, 'U_3');
  assert.equal(first.summary.taskCount, 0);
  assert.equal(first.planHash, second.planHash);
});
