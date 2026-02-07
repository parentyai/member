'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { recordOpsNextAction } = require('../../src/usecases/phase24/recordOpsNextAction');

test('phase24 t07: recordOpsNextAction appends decisionLog and upserts opsState', async () => {
  const calls = { append: 0, upsert: 0 };
  const deps = {
    decisionLogsRepo: {
      appendDecision: async () => {
        calls.append += 1;
        return { id: 'd1' };
      }
    },
    opsStatesRepo: {
      upsertOpsState: async () => {
        calls.upsert += 1;
      },
      getOpsState: async () => ({ id: 'U1', nextAction: 'NO_ACTION' })
    }
  };
  const result = await recordOpsNextAction({
    lineUserId: 'U1',
    nextAction: 'NO_ACTION',
    failure_class: 'PASS',
    decidedBy: 'ops'
  }, deps);
  assert.strictEqual(calls.append, 1);
  assert.strictEqual(calls.upsert, 1);
  assert.strictEqual(result.decisionLogId, 'd1');
});

test('phase24 t07: invalid nextAction is rejected', async () => {
  await assert.rejects(
    () => recordOpsNextAction({
      lineUserId: 'U1',
      nextAction: 'BAD',
      failure_class: 'PASS',
      decidedBy: 'ops'
    }, { decisionLogsRepo: {}, opsStatesRepo: {} }),
    /invalid nextAction/
  );
});
