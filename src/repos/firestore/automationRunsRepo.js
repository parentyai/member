'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'automation_runs';

function resolveTimestamp() {
  return serverTimestamp();
}

async function createRun(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const payload = Object.assign({}, data || {}, {
    createdAt: resolveTimestamp(),
    updatedAt: resolveTimestamp()
  });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

async function patchRun(id, patch) {
  if (!id) throw new Error('runId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const payload = Object.assign({}, patch || {}, { updatedAt: resolveTimestamp() });
  await docRef.set(payload, { merge: true });
  return { id };
}

async function getRun(id) {
  if (!id) throw new Error('runId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

module.exports = {
  createRun,
  patchRun,
  getRun
};
