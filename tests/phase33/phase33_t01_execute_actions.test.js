'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { executeOpsNextAction } = require('../../src/usecases/phase33/executeOpsNextAction');

function buildBaseDeps(capture) {
  return {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE']
    }),
    decisionLogsRepo: {
      listDecisions: async () => ([]),
      getDecisionById: async () => ({ id: 'd1' }),
      appendDecision: async (payload) => {
        capture.push(payload);
        return { id: 'exec-1' };
      }
    },
    opsStatesRepo: {
      upsertOpsState: async () => ({ id: 'U1' })
    },
    runPhase2Automation: async () => ({ ok: true, summary: {} }),
    notifyEscalation: async () => ({ ok: true, sideEffects: ['notification_sent'] }),
    createTodo: async () => ({}),
    createChecklist: async () => ({})
  };
}

test('phase33 t01: execute actions return execution snapshots', async () => {
  const captured = [];
  const deps = buildBaseDeps(captured);

  const noAction = await executeOpsNextAction({ lineUserId: 'U1', decisionLogId: 'd1', action: 'NO_ACTION' }, deps);
  assert.strictEqual(noAction.ok, true);
  assert.strictEqual(noAction.execution.action, 'NO_ACTION');

  const rerun = await executeOpsNextAction({ lineUserId: 'U1', decisionLogId: 'd1', action: 'RERUN_MAIN' }, deps);
  assert.strictEqual(rerun.ok, true);
  assert.ok(rerun.execution.sideEffects.includes('workflow_triggered'));

  const fix = await executeOpsNextAction({ lineUserId: 'U1', decisionLogId: 'd1', action: 'FIX_AND_RERUN' }, deps);
  assert.strictEqual(fix.ok, true);
  assert.ok(fix.execution.sideEffects.includes('ops_note_created'));

  const stop = await executeOpsNextAction({ lineUserId: 'U1', decisionLogId: 'd1', action: 'STOP_AND_ESCALATE' }, deps);
  assert.strictEqual(stop.ok, true);
  assert.ok(stop.execution.sideEffects.includes('notification_sent'));

  const lastLog = captured[captured.length - 1];
  assert.strictEqual(lastLog.subjectType, 'ops_execution');
  assert.strictEqual(lastLog.subjectId, 'd1');
});

