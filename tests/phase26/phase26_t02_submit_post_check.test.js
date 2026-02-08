'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');

test('phase26 t02: postCheck verifies READY decisions', async () => {
  let savedAudit = null;
  let savedNextAction = null;
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      recommendedNextAction: 'NO_ACTION',
      allowedNextActions: ['NO_ACTION', 'STOP_AND_ESCALATE'],
      serverTime: '2026-02-08T02:30:00.000Z'
    }),
    recordOpsNextAction: async (payload) => {
      savedAudit = payload.audit;
      savedNextAction = payload.nextAction;
      return {
        decisionLogId: 'd1',
        opsState: {
          id: payload.lineUserId,
          nextAction: payload.nextAction,
          sourceDecisionLogId: 'd1'
        }
      };
    },
    decisionLogsRepo: {
      getDecisionById: async (id) => ({
        id,
        audit: savedAudit,
        nextAction: savedNextAction
      })
    }
  };

  const result = await submitOpsDecision({
    lineUserId: 'U1',
    decision: { nextAction: 'NO_ACTION', failure_class: 'PASS' },
    decidedBy: 'ops',
    dryRun: false
  }, deps);

  assert.strictEqual(result.ok, true);
  assert.ok(result.postCheck);
  assert.strictEqual(result.postCheck.ok, true);
  assert.strictEqual(result.postCheck.checks.length, 3);
  for (const check of result.postCheck.checks) {
    assert.strictEqual(check.ok, true);
    assert.ok(typeof check.name === 'string');
    assert.ok(typeof check.detail === 'string');
  }
});

test('phase26 t02: postCheck verifies NOT_READY decisions', async () => {
  let savedAudit = null;
  let savedNextAction = null;
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'NOT_READY', blocking: ['missing_ops_state'] },
      recommendedNextAction: 'STOP_AND_ESCALATE',
      allowedNextActions: ['STOP_AND_ESCALATE'],
      serverTime: '2026-02-08T02:31:00.000Z'
    }),
    recordOpsNextAction: async (payload) => {
      savedAudit = payload.audit;
      savedNextAction = payload.nextAction;
      return {
        decisionLogId: 'd2',
        opsState: {
          id: payload.lineUserId,
          nextAction: payload.nextAction,
          sourceDecisionLogId: 'd2'
        }
      };
    },
    decisionLogsRepo: {
      getDecisionById: async (id) => ({
        id,
        audit: savedAudit,
        nextAction: savedNextAction
      })
    }
  };

  const result = await submitOpsDecision({
    lineUserId: 'U2',
    decision: { nextAction: 'STOP_AND_ESCALATE', failure_class: 'ENV' },
    decidedBy: 'ops',
    dryRun: false
  }, deps);

  assert.strictEqual(result.ok, true);
  assert.ok(result.postCheck);
  assert.strictEqual(result.postCheck.ok, true);
  assert.strictEqual(result.postCheck.checks.length, 3);
  for (const check of result.postCheck.checks) {
    assert.strictEqual(check.ok, true);
    assert.ok(typeof check.name === 'string');
    assert.ok(typeof check.detail === 'string');
  }
});
