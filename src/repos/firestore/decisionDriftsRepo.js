'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'decision_drifts';

function resolveTimestamp() {
  return serverTimestamp();
}

async function appendDecisionDrift(data) {
  const payload = data || {};
  if (!payload.decisionLogId) throw new Error('decisionLogId required');
  if (!payload.lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const record = Object.assign({}, payload, { createdAt: resolveTimestamp() });
  await docRef.set(record, { merge: false });
  return { id: docRef.id };
}

async function getLatestDecisionDrift(lineUserId) {
  if (!lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .where('lineUserId', '==', lineUserId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (!snap.docs.length) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

module.exports = {
  appendDecisionDrift,
  getLatestDecisionDrift
};
