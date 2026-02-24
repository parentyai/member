'use strict';

const crypto = require('crypto');

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'journey_reminder_runs';

function normalizeRunId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function createRunId() {
  return `jrr_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function normalizeSummary(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const toInt = (value, fallback) => {
    const num = Number(value);
    return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : fallback;
  };
  return {
    runId: normalizeRunId(payload.runId),
    startedAt: payload.startedAt || null,
    finishedAt: payload.finishedAt || null,
    scannedCount: toInt(payload.scannedCount, 0),
    sentCount: toInt(payload.sentCount, 0),
    skippedCount: toInt(payload.skippedCount, 0),
    failedCount: toInt(payload.failedCount, 0),
    dryRun: payload.dryRun === true,
    traceId: typeof payload.traceId === 'string' ? payload.traceId.trim() : null,
    actor: typeof payload.actor === 'string' ? payload.actor.trim() : null,
    requestId: typeof payload.requestId === 'string' ? payload.requestId.trim() : null,
    errorSample: Array.isArray(payload.errorSample) ? payload.errorSample.slice(0, 20) : []
  };
}

async function createJourneyReminderRun(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const runId = normalizeRunId(payload.runId) || createRunId();
  const db = getDb();
  const data = normalizeSummary(Object.assign({}, payload, {
    runId,
    startedAt: payload.startedAt || serverTimestamp(),
    finishedAt: null,
    scannedCount: 0,
    sentCount: 0,
    skippedCount: 0,
    failedCount: 0
  }));
  await db.collection(COLLECTION).doc(runId).set(data, { merge: true });
  return Object.assign({}, data, { runId });
}

async function finishJourneyReminderRun(runId, patch) {
  const id = normalizeRunId(runId);
  if (!id) throw new Error('runId required');
  const payload = patch && typeof patch === 'object' ? patch : {};
  const db = getDb();
  const toInt = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : null;
  };
  const data = {
    runId: id,
    finishedAt: payload.finishedAt || serverTimestamp()
  };
  const scannedCount = toInt(payload.scannedCount);
  const sentCount = toInt(payload.sentCount);
  const skippedCount = toInt(payload.skippedCount);
  const failedCount = toInt(payload.failedCount);
  if (scannedCount !== null) data.scannedCount = scannedCount;
  if (sentCount !== null) data.sentCount = sentCount;
  if (skippedCount !== null) data.skippedCount = skippedCount;
  if (failedCount !== null) data.failedCount = failedCount;
  if (Array.isArray(payload.errorSample)) data.errorSample = payload.errorSample.slice(0, 20);
  await db.collection(COLLECTION).doc(id).set(data, { merge: true });
  return getJourneyReminderRun(id);
}

async function getJourneyReminderRun(runId) {
  const id = normalizeRunId(runId);
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeSummary(Object.assign({ runId: id }, snap.data()));
}

module.exports = {
  COLLECTION,
  createRunId,
  createJourneyReminderRun,
  finishJourneyReminderRun,
  getJourneyReminderRun
};
