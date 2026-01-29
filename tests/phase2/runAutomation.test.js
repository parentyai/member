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
const { runPhase2Automation } = require('../../src/usecases/phase2/runAutomation');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  process.env.PHASE2_AUTOMATION_ENABLED = 'true';
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
  delete process.env.PHASE2_AUTOMATION_ENABLED;
});

async function seedBasicData(db) {
  await db.collection('users').doc('U1').set({ scenario: 'A' });
  await db.collection('events').doc('E1').set({
    lineUserId: 'U1',
    type: 'open',
    createdAt: '2026-01-29T10:00:00Z'
  });
  await db.collection('checklists').doc('C1').set({
    scenario: 'A',
    step: '3mo',
    items: [{ itemId: 'i1' }]
  });
  await db.collection('user_checklists').doc('U1__C1__i1').set({
    lineUserId: 'U1',
    checklistId: 'C1',
    itemId: 'i1',
    completedAt: '2026-01-29T11:00:00Z'
  });
}

test('runPhase2Automation: dryRun does not write reports', async () => {
  const db = createDbStub();
  setDbForTest(db);
  await seedBasicData(db);

  const result = await runPhase2Automation({
    runId: 'run-1',
    targetDate: '2026-01-29',
    dryRun: true
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.summary.counts.dailyReports, 1);
  assert.strictEqual(result.summary.counts.weeklyReports, 1);
  assert.strictEqual(result.summary.counts.checklistReports, 1);
  assert.ok(!db._state.collections.phase2_reports_daily_events);
  assert.ok(!db._state.collections.phase2_runs);
});

test('runPhase2Automation: writes reports when not dryRun', async () => {
  const db = createDbStub();
  setDbForTest(db);
  await seedBasicData(db);

  const result = await runPhase2Automation({
    runId: 'run-2',
    targetDate: '2026-01-29',
    dryRun: false
  });

  assert.strictEqual(result.ok, true);
  const runs = db._state.collections.phase2_runs;
  const daily = db._state.collections.phase2_reports_daily_events;
  const weekly = db._state.collections.phase2_reports_weekly_events;
  const checklist = db._state.collections.phase2_reports_checklist_pending;
  assert.ok(runs && runs.docs['run-2']);
  assert.ok(daily);
  assert.ok(weekly);
  assert.ok(checklist);
});
