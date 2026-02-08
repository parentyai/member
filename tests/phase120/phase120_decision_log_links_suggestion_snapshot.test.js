'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { recordOpsNextAction } = require('../../src/usecases/phase24/recordOpsNextAction');

test('phase120: decision log stores source + suggestion snapshot', async () => {
  let captured = null;
  const deps = {
    decisionLogsRepo: {
      appendDecision: async (payload) => {
        captured = payload;
        return { id: 'd1' };
      }
    },
    opsStatesRepo: {
      upsertOpsState: async () => ({ id: 'U1' }),
      getOpsState: async () => ({ id: 'U1', nextAction: 'NO_ACTION' })
    }
  };

  await recordOpsNextAction({
    lineUserId: 'U1',
    nextAction: 'NO_ACTION',
    failure_class: 'PASS',
    decidedBy: 'ops',
    note: 'ok',
    source: 'ops_console',
    suggestionSnapshot: { action: 'NO_ACTION', reason: 'safe' }
  }, deps);

  assert.ok(captured);
  assert.strictEqual(captured.source, 'ops_console');
  assert.deepStrictEqual(captured.suggestionSnapshot, { action: 'NO_ACTION', reason: 'safe' });
});
