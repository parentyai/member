'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const decisionTimelineRepo = require('../../src/repos/firestore/decisionTimelineRepo');
const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');
const { executeOpsNextAction } = require('../../src/usecases/phase33/executeOpsNextAction');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase36: decision timeline appends DECIDE/POSTCHECK/EXECUTE', async () => {
  const depsSubmit = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      allowedNextActions: ['NO_ACTION'],
      recommendedNextAction: 'NO_ACTION',
      serverTime: '2026-02-08T00:00:00.000Z'
    }),
    recordOpsNextAction: async () => ({ decisionLogId: 'd1', opsState: { id: 'U1' } }),
    decisionTimelineRepo
  };

  await submitOpsDecision({
    lineUserId: 'U1',
    decision: { nextAction: 'NO_ACTION', failure_class: 'PASS' },
    decidedBy: 'ops',
    dryRun: false
  }, depsSubmit);

  const depsExecute = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      allowedNextActions: ['NO_ACTION']
    }),
    decisionLogsRepo: {
      listDecisions: async () => ([]),
      getDecisionById: async () => ({ id: 'd1' }),
      appendDecision: async () => ({ id: 'exec-1' })
    },
    opsStatesRepo: { upsertOpsState: async () => ({}) },
    decisionTimelineRepo
  };

  await executeOpsNextAction({ lineUserId: 'U1', decisionLogId: 'd1', action: 'NO_ACTION' }, depsExecute);

  const entries = await decisionTimelineRepo.listTimelineEntries('U1', 10);
  const actions = entries.map((entry) => entry.action);
  assert.ok(actions.includes('DECIDE'));
  assert.ok(actions.includes('POSTCHECK'));
  assert.ok(actions.includes('EXECUTE'));
});
