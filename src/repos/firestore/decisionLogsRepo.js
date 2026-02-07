'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'decision_logs';

function resolveTimestamp() {
  return serverTimestamp();
}

async function appendDecision(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const payload = Object.assign({}, data || {}, {
    decidedAt: resolveTimestamp(),
    createdAt: resolveTimestamp()
  });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

async function getLatestDecision(subjectType, subjectId) {
  if (!subjectType) throw new Error('subjectType required');
  if (!subjectId) throw new Error('subjectId required');
  const db = getDb();
  let query = db.collection(COLLECTION)
    .where('subjectType', '==', subjectType)
    .where('subjectId', '==', subjectId)
    .orderBy('decidedAt', 'desc')
    .limit(1);
  const snap = await query.get();
  if (!snap.docs.length) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

async function listDecisions(subjectType, subjectId, limit) {
  if (!subjectType) throw new Error('subjectType required');
  if (!subjectId) throw new Error('subjectId required');
  const db = getDb();
  let query = db.collection(COLLECTION)
    .where('subjectType', '==', subjectType)
    .where('subjectId', '==', subjectId)
    .orderBy('decidedAt', 'desc');
  const cap = typeof limit === 'number' ? limit : 50;
  if (cap) query = query.limit(cap);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  appendDecision,
  getLatestDecision,
  listDecisions
};
