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
const scenarioReportsRepo = require('../../src/repos/firestore/scenarioReportsRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('scenarioReportsRepo: canonical writes keep scenarioKey and fallback to legacy scenario input', async () => {
  const db = createDbStub();
  setDbForTest(db);
  await scenarioReportsRepo.upsertDailyEventReport({
    date: '2026-01-29',
    scenarioKey: 'A',
    counts: { open: 1, click: 0, complete: 0 },
    runId: 'run-s1'
  });
  await scenarioReportsRepo.upsertWeeklyEventReport({
    weekStart: '2026-01-25',
    scenario: 'B',
    counts: { open: 0, click: 1, complete: 0 },
    runId: 'run-s2'
  });

  const dailyCollection = db._state.collections.phase2_reports_daily_events;
  const weeklyCollection = db._state.collections.phase2_reports_weekly_events;
  const dailyDoc = dailyCollection && dailyCollection.docs['2026-01-29__A'] && dailyCollection.docs['2026-01-29__A'].data;
  const weeklyDoc = weeklyCollection && weeklyCollection.docs['2026-01-25__B'] && weeklyCollection.docs['2026-01-25__B'].data;

  assert.strictEqual(dailyDoc.scenarioKey, 'A');
  assert.strictEqual(weeklyDoc.scenarioKey, 'B');
});
