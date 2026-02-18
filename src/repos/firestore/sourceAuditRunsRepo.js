'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { sortByTimestampDesc } = require('./queryFallback');

const COLLECTION = 'source_audit_runs';

async function getRun(runId) {
  if (!runId) throw new Error('runId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(runId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function saveRun(runId, patch, options) {
  if (!runId) throw new Error('runId required');
  const db = getDb();
  const payload = Object.assign({}, patch || {}, { updatedAt: serverTimestamp() });
  const merge = !(options && options.overwrite === true);
  await db.collection(COLLECTION).doc(runId).set(payload, { merge });
  return { id: runId };
}

async function listRuns(limit) {
  const cap = Number.isFinite(Number(limit)) ? Math.min(Math.max(Math.floor(Number(limit)), 1), 100) : 20;
  const db = getDb();
  const snap = await db.collection(COLLECTION).limit(cap).get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  sortByTimestampDesc(rows, 'startedAt');
  return rows.slice(0, cap);
}

module.exports = {
  getRun,
  saveRun,
  listRuns
};
