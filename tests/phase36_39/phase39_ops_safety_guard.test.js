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

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase39: stale console is rejected and logged', async () => {
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      allowedNextActions: ['NO_ACTION'],
      recommendedNextAction: 'NO_ACTION',
      serverTime: '2026-02-08T00:00:00.000Z',
      opsState: null,
      latestDecisionLog: null
    }),
    decisionTimelineRepo
  };

  let error = null;
  try {
    await submitOpsDecision({
      lineUserId: 'U1',
      decision: { nextAction: 'NO_ACTION', failure_class: 'PASS' },
      decidedBy: 'ops',
      dryRun: false,
      consoleServerTime: '2026-02-07T00:00:00Z',
      maxConsoleAgeMs: 1000
    }, deps);
  } catch (err) {
    error = err;
  }

  assert.ok(error);
  assert.strictEqual(error.message, 'ops safety guard failed');

  const entries = await decisionTimelineRepo.listTimelineEntries('U1', 5);
  assert.ok(entries.length > 0);
  const guardEntry = entries.find((entry) => entry.action === 'DECIDE');
  assert.ok(guardEntry);
  assert.strictEqual(guardEntry.snapshot.guard.status, 'FAIL');
  assert.ok(guardEntry.snapshot.guard.reasons.includes('stale_console'));
});
