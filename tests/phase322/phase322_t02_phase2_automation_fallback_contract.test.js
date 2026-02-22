'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest } = require('../../src/infra/firestore');
const { runPhase2Automation } = require('../../src/usecases/phase2/runAutomation');

beforeEach(() => {
  process.env.PHASE2_AUTOMATION_ENABLED = 'true';
});

afterEach(() => {
  clearDbForTest();
  delete process.env.PHASE2_AUTOMATION_ENABLED;
});

async function seedBase(db) {
  await db.collection('users').doc('U1').set({
    scenario: 'A',
    createdAt: '2026-01-01T00:00:00Z'
  });
  await db.collection('checklists').doc('C1').set({
    scenario: 'A',
    step: '3mo',
    items: [{ itemId: 'i1' }],
    createdAt: '2026-01-01T00:00:00Z'
  });
  await db.collection('user_checklists').doc('U1__C1__i1').set({
    lineUserId: 'U1',
    checklistId: 'C1',
    itemId: 'i1',
    createdAt: '2026-01-01T00:00:00Z'
  });
}

test('phase322: phase2 automation falls back to listAll events when weekly range is empty', async () => {
  const db = createDbStub();
  setDbForTest(db);
  await seedBase(db);
  await db.collection('events').doc('E-old').set({
    lineUserId: 'U1',
    type: 'open',
    createdAt: '2025-12-01T10:00:00Z'
  });

  const result = await runPhase2Automation({
    runId: 'phase322-fallback-1',
    targetDate: '2026-01-29',
    dryRun: true
  });

  assert.strictEqual(result.ok, true);
  assert.ok(
    result.summary.readPath.eventsSource === 'fallback_all' ||
      result.summary.readPath.eventsSource === 'fallback_bounded'
  );
  assert.strictEqual(result.summary.readPath.analyticsLimit, 1000);
  assert.strictEqual(result.summary.counts.dailyReports, 0);
  assert.strictEqual(result.summary.counts.weeklyReports, 0);
});
