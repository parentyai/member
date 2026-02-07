'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');

test('phase25 t02: dryRun does not write and returns readiness', async () => {
  let called = 0;
  const readiness = { status: 'NOT_READY', blocking: ['ops_state:missing_ops_state'] };
  const deps = {
    getOpsConsole: async () => ({
      readiness,
      recommendedNextAction: 'STOP_AND_ESCALATE',
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
      serverTime: '2026-02-07T21:30:00.000Z'
    }),
    recordOpsNextAction: async () => {
      called += 1;
      return { decisionLogId: 'd1', opsState: { id: 'U1' } };
    }
  };

  const result = await submitOpsDecision({
    lineUserId: 'U1',
    decision: {
      nextAction: 'STOP_AND_ESCALATE',
      failure_class: 'IMPL',
      reasonCode: 'SUBPROCESS_EXIT_NONZERO',
      stage: 'kpi_gate',
      note: 'delta_ctr_lt_min'
    },
    decidedBy: 'ops',
    dryRun: true
  }, deps);

  assert.strictEqual(called, 0);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.readiness, readiness);
  assert.deepStrictEqual(result.audit.blocking, readiness.blocking);
  assert.strictEqual(result.decisionLogId, null);
  assert.strictEqual(result.opsState.nextAction, 'STOP_AND_ESCALATE');
  assert.strictEqual(result.dryRun, true);
});

test('phase25 t02: dryRun false writes and returns decisionLogId', async () => {
  let called = 0;
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      recommendedNextAction: 'NO_ACTION',
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
      serverTime: '2026-02-07T21:30:00.000Z'
    }),
    recordOpsNextAction: async () => {
      called += 1;
      return { decisionLogId: 'd123', opsState: { id: 'U1', nextAction: 'NO_ACTION' } };
    }
  };

  const result = await submitOpsDecision({
    lineUserId: 'U1',
    decision: { nextAction: 'NO_ACTION', failure_class: 'PASS' },
    decidedBy: 'ops',
    dryRun: false
  }, deps);

  assert.strictEqual(called, 1);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.decisionLogId, 'd123');
  assert.strictEqual(result.opsState.nextAction, 'NO_ACTION');
  assert.strictEqual(result.dryRun, false);
});

test('phase25 t02: readiness NOT_READY still returns ok', async () => {
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'NOT_READY', blocking: ['missing_notification_summary'] },
      recommendedNextAction: 'STOP_AND_ESCALATE',
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
      serverTime: '2026-02-07T21:30:00.000Z'
    }),
    recordOpsNextAction: async () => ({ decisionLogId: 'd9', opsState: { id: 'U1' } })
  };

  const result = await submitOpsDecision({
    lineUserId: 'U1',
    decision: { nextAction: 'STOP_AND_ESCALATE', failure_class: 'ENV' },
    decidedBy: 'ops',
    dryRun: false
  }, deps);

  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.readiness, { status: 'NOT_READY', blocking: ['missing_notification_summary'] });
});
