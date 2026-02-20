'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'phase2_runs';

async function getRun(runId) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(runId);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function upsertRun(runId, patch) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(runId);
  const record = Object.assign({}, patch, { updatedAt: serverTimestamp() });
  await docRef.set(record, { merge: true });
}

module.exports = {
  getRun,
  upsertRun
};
