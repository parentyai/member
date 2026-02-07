'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'ops_states';

async function upsertOpsState(lineUserId, data) {
  if (!lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(lineUserId);
  const payload = Object.assign({}, data || {}, { updatedAt: serverTimestamp() });
  await docRef.set(payload, { merge: true });
  return { id: lineUserId };
}

async function getOpsState(lineUserId) {
  if (!lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(lineUserId);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

module.exports = {
  upsertOpsState,
  getOpsState
};
