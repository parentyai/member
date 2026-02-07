'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');

test('phase25 t05: READY writes audit snapshot', async () => {
  let received = null;
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      recommendedNextAction: 'NO_ACTION',
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
      serverTime: '2026-02-07T21:30:00.000Z'
    }),
    recordOpsNextAction: async (payload) => {
      received = payload;
      return { decisionLogId: 'd1', opsState: { id: 'U1', nextAction: 'NO_ACTION' } };
    }
  };

  const result = await submitOpsDecision({
    lineUserId: 'U1',
    decision: { nextAction: 'NO_ACTION', failure_class: 'PASS' },
    decidedBy: 'ops',
    dryRun: false
  }, deps);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.audit.readinessStatus, 'READY');
  assert.deepStrictEqual(result.audit.blocking, []);
  assert.strictEqual(result.audit.recommendedNextAction, 'NO_ACTION');
  assert.ok(Array.isArray(result.audit.allowedNextActions));
  assert.strictEqual(received.audit.readinessStatus, 'READY');
  assert.deepStrictEqual(received.audit.blocking, []);
});

test('phase25 t05: READY rejects nextAction not in allowedNextActions', async () => {
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      recommendedNextAction: 'NO_ACTION',
      allowedNextActions: ['NO_ACTION'],
      serverTime: '2026-02-07T21:30:00.000Z'
    })
  };

  await assert.rejects(
    submitOpsDecision({
      lineUserId: 'U1',
      decision: { nextAction: 'FIX_AND_RERUN', failure_class: 'IMPL' },
      decidedBy: 'ops',
      dryRun: false
    }, deps),
    /invalid nextAction/
  );
});

test('phase25 t05: NOT_READY allows only STOP_AND_ESCALATE', async () => {
  const readiness = { status: 'NOT_READY', blocking: ['missing_ops_state'] };
  const deps = {
    getOpsConsole: async () => ({
      readiness,
      recommendedNextAction: 'STOP_AND_ESCALATE',
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
      serverTime: '2026-02-07T21:30:00.000Z'
    }),
    recordOpsNextAction: async () => ({ decisionLogId: 'd9', opsState: { id: 'U1' } })
  };

  await assert.rejects(
    submitOpsDecision({
      lineUserId: 'U1',
      decision: { nextAction: 'RERUN_MAIN', failure_class: 'ENV' },
      decidedBy: 'ops',
      dryRun: false
    }, deps),
    /invalid nextAction/
  );

  const okResult = await submitOpsDecision({
    lineUserId: 'U1',
    decision: { nextAction: 'STOP_AND_ESCALATE', failure_class: 'ENV' },
    decidedBy: 'ops',
    dryRun: false
  }, deps);

  assert.strictEqual(okResult.ok, true);
  assert.strictEqual(okResult.audit.readinessStatus, 'NOT_READY');
  assert.deepStrictEqual(okResult.audit.blocking, readiness.blocking);
});
