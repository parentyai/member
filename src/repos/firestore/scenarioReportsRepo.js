'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const DAILY_COLLECTION = 'phase2_reports_daily_events';
const WEEKLY_COLLECTION = 'phase2_reports_weekly_events';
const CHECKLIST_COLLECTION = 'phase2_reports_checklist_pending';

function normalizeScenario(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeScenarioKeyFromPayload(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  return normalizeScenario(data.scenarioKey) || normalizeScenario(data.scenario);
}

function dailyDocId(date, scenario) {
  return `${date}__${scenario}`;
}

function weeklyDocId(weekStart, scenario) {
  return `${weekStart}__${scenario}`;
}

function checklistDocId(date, scenario, step) {
  return `${date}__${scenario}__${step}`;
}

async function upsertDailyEventReport({ date, scenarioKey, scenario, counts, runId }) {
  const db = getDb();
  const scenarioValue = normalizeScenarioKeyFromPayload({ scenarioKey, scenario });
  const docRef = db.collection(DAILY_COLLECTION).doc(dailyDocId(date, scenarioValue));
  const record = {
    date,
    scenarioKey: scenarioValue,
    counts: counts || { open: 0, click: 0, complete: 0 },
    lastRunId: runId || null,
    updatedAt: serverTimestamp()
  };
  await docRef.set(record, { merge: true });
}

async function upsertWeeklyEventReport({ weekStart, scenarioKey, scenario, counts, runId }) {
  const db = getDb();
  const scenarioValue = normalizeScenarioKeyFromPayload({ scenarioKey, scenario });
  const docRef = db.collection(WEEKLY_COLLECTION).doc(weeklyDocId(weekStart, scenarioValue));
  const record = {
    weekStart,
    scenarioKey: scenarioValue,
    counts: counts || { open: 0, click: 0, complete: 0 },
    lastRunId: runId || null,
    updatedAt: serverTimestamp()
  };
  await docRef.set(record, { merge: true });
}

async function upsertChecklistPendingReport({ date, scenarioKey, scenario, step, totalTargets, completedCount, pendingCount, runId }) {
  const db = getDb();
  const scenarioValue = normalizeScenarioKeyFromPayload({ scenarioKey, scenario });
  const docRef = db.collection(CHECKLIST_COLLECTION).doc(checklistDocId(date, scenarioValue, step));
  const record = {
    date,
    scenarioKey: scenarioValue,
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
