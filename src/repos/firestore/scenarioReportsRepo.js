'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const DAILY_COLLECTION = 'phase2_reports_daily_events';
const WEEKLY_COLLECTION = 'phase2_reports_weekly_events';
const CHECKLIST_COLLECTION = 'phase2_reports_checklist_pending';

function dailyDocId(date, scenario) {
  return `${date}__${scenario}`;
}

function weeklyDocId(weekStart, scenario) {
  return `${weekStart}__${scenario}`;
}

function checklistDocId(date, scenario, step) {
  return `${date}__${scenario}__${step}`;
}

async function upsertDailyEventReport({ date, scenario, counts, runId }) {
  const db = getDb();
  const docRef = db.collection(DAILY_COLLECTION).doc(dailyDocId(date, scenario));
  const record = {
    date,
    scenario,
    counts: counts || { open: 0, click: 0, complete: 0 },
    lastRunId: runId || null,
    updatedAt: serverTimestamp()
  };
  await docRef.set(record, { merge: true });
}

async function upsertWeeklyEventReport({ weekStart, scenario, counts, runId }) {
  const db = getDb();
  const docRef = db.collection(WEEKLY_COLLECTION).doc(weeklyDocId(weekStart, scenario));
  const record = {
    weekStart,
    scenario,
    counts: counts || { open: 0, click: 0, complete: 0 },
    lastRunId: runId || null,
    updatedAt: serverTimestamp()
  };
  await docRef.set(record, { merge: true });
}

async function upsertChecklistPendingReport({ date, scenario, step, totalTargets, completedCount, pendingCount, runId }) {
  const db = getDb();
  const docRef = db.collection(CHECKLIST_COLLECTION).doc(checklistDocId(date, scenario, step));
  const record = {
    date,
    scenario,
    step,
    totalTargets,
    completedCount,
    pendingCount,
    lastRunId: runId || null,
    updatedAt: serverTimestamp()
  };
  await docRef.set(record, { merge: true });
}

module.exports = {
  upsertDailyEventReport,
  upsertWeeklyEventReport,
  upsertChecklistPendingReport,
  dailyDocId,
  weeklyDocId,
  checklistDocId
};
