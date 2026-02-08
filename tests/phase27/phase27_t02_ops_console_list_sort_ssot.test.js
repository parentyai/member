'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase27 t02: list sorts READY first then cursorCandidate desc then lineUserId', async () => {
  const deps = {
    listUsers: async () => ([
      { id: 'U1' },
      { id: 'U3' },
      { id: 'U2' }
    ]),
    getOpsConsole: async ({ lineUserId }) => {
      if (lineUserId === 'U1') {
        return {
          readiness: { status: 'READY', blocking: [] },
          recommendedNextAction: 'NO_ACTION',
          allowedNextActions: ['NO_ACTION'],
          opsState: { id: 'U1', updatedAt: '2026-02-08T03:00:00.000Z' },
          latestDecisionLog: { id: 'd1', decidedAt: '2026-02-08T02:59:00.000Z' }
        };
      }
      if (lineUserId === 'U2') {
        return {
          readiness: { status: 'READY', blocking: [] },
          recommendedNextAction: 'NO_ACTION',
          allowedNextActions: ['NO_ACTION'],
          opsState: { id: 'U2', updatedAt: '2026-02-08T03:10:00.000Z' },
          latestDecisionLog: { id: 'd2', decidedAt: '2026-02-08T03:09:00.000Z' }
        };
      }
      return {
        readiness: { status: 'NOT_READY', blocking: ['missing_ops_state'] },
        recommendedNextAction: 'STOP_AND_ESCALATE',
        allowedNextActions: ['STOP_AND_ESCALATE'],
        opsState: { id: 'U3', updatedAt: '2026-02-08T03:20:00.000Z' },
        latestDecisionLog: { id: 'd3', decidedAt: '2026-02-08T03:19:00.000Z' }
      };
    }
  };

  const result = await listOpsConsole({ status: 'ALL', limit: 50 }, deps);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.items.map((item) => item.lineUserId), ['U2', 'U1', 'U3']);
});

test('phase27 t02: list stabilizes order by lineUserId when cursorCandidate is null', async () => {
  const deps = {
    listUsers: async () => ([
      { id: 'U9' },
      { id: 'U1' }
    ]),
    getOpsConsole: async () => ({
      readiness: { status: 'NOT_READY', blocking: [] },
      recommendedNextAction: 'STOP_AND_ESCALATE',
      allowedNextActions: ['STOP_AND_ESCALATE'],
      opsState: null,
      latestDecisionLog: null
    })
  };

  const result = await listOpsConsole({ status: 'ALL', limit: 50 }, deps);
  assert.deepStrictEqual(result.items.map((item) => item.lineUserId), ['U1', 'U9']);
});
