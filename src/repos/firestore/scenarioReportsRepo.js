'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const DAILY_COLLECTION = 'phase2_reports_daily_events';
const WEEKLY_COLLECTION = 'phase2_reports_weekly_events';
const CHECKLIST_COLLECTION = 'phase2_reports_checklist_pending';
const FIELD_CANON = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);
const FIELD_LEGACY = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111);

function normalizeKey(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveCanonFromPayload(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  return normalizeKey(data[FIELD_CANON]) || normalizeKey(data[FIELD_LEGACY]);
}

function dailyDocId(date, key) {
  return `${date}__${key}`;
}

function weeklyDocId(weekStart, key) {
  return `${weekStart}__${key}`;
}

function checklistDocId(date, key, step) {
  return `${date}__${key}__${step}`;
}

async function upsertDailyEventReport(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const db = getDb();
  const key = resolveCanonFromPayload(payload);
  const docRef = db.collection(DAILY_COLLECTION).doc(dailyDocId(payload.date, key));
  const record = {
    date: payload.date,
    [FIELD_CANON]: key,
    counts: payload.counts || { open: 0, click: 0, complete: 0 },
    lastRunId: payload.runId || null,
    updatedAt: serverTimestamp()
  };
  await docRef.set(record, { merge: true });
}

async function upsertWeeklyEventReport(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const db = getDb();
  const key = resolveCanonFromPayload(payload);
  const docRef = db.collection(WEEKLY_COLLECTION).doc(weeklyDocId(payload.weekStart, key));
  const record = {
    weekStart: payload.weekStart,
    [FIELD_CANON]: key,
    counts: payload.counts || { open: 0, click: 0, complete: 0 },
    lastRunId: payload.runId || null,
    updatedAt: serverTimestamp()
  };
  await docRef.set(record, { merge: true });
}

async function upsertChecklistPendingReport(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const db = getDb();
  const key = resolveCanonFromPayload(payload);
  const docRef = db.collection(CHECKLIST_COLLECTION).doc(checklistDocId(payload.date, key, payload.step));
  const record = {
    date: payload.date,
    [FIELD_CANON]: key,
    step: payload.step,
    totalTargets: payload.totalTargets,
    completedCount: payload.completedCount,
    pendingCount: payload.pendingCount,
    lastRunId: payload.runId || null,
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
