'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { sortByTimestampDesc } = require('./queryFallback');

const COLLECTION = 'source_audit_runs';

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return defaultValue === true;
}

function isSourceAuditRunsOrderByEnabled() {
  return resolveBooleanEnvFlag('ENABLE_CITY_PACK_AUDIT_RUNS_ORDERBY_V1', true);
}

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
  if (isSourceAuditRunsOrderByEnabled()) {
    try {
      const startedAtSnap = await db.collection(COLLECTION).orderBy('startedAt', 'desc').limit(cap).get();
      return startedAtSnap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data())).slice(0, cap);
    } catch (_err) {
      try {
        const createdAtSnap = await db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(cap).get();
        return createdAtSnap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data())).slice(0, cap);
      } catch (_fallbackErr) {
        // fall through to legacy path
      }
    }
  }
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
