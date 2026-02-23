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
  const baseQuery = db.collection(COLLECTION)
    .where('subjectType', '==', subjectType)
    .where('subjectId', '==', subjectId);
  const snap = await baseQuery.orderBy('decidedAt', 'desc').limit(1).get();
  if (!snap.docs.length) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

async function listDecisions(subjectType, subjectId, limit) {
  if (!subjectType) throw new Error('subjectType required');
  if (!subjectId) throw new Error('subjectId required');
  const db = getDb();
  const baseQuery = db.collection(COLLECTION)
    .where('subjectType', '==', subjectType)
    .where('subjectId', '==', subjectId);
  let query = baseQuery.orderBy('decidedAt', 'desc');
  const cap = typeof limit === 'number' ? limit : 50;
  if (cap) query = query.limit(cap);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

async function getDecisionById(decisionLogId) {
  if (!decisionLogId) throw new Error('decisionLogId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(decisionLogId);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listDecisionsByNotificationId(notificationId, limit, direction) {
  if (!notificationId) throw new Error('notificationId required');
  const db = getDb();
  const dir = direction === 'asc' ? 'asc' : 'desc';
  const baseQuery = db.collection(COLLECTION).where('audit.notificationId', '==', notificationId);
  let query = baseQuery.orderBy('decidedAt', dir);
  const cap = typeof limit === 'number' ? limit : 50;
  if (cap) query = query.limit(cap);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  appendDecision,
  getLatestDecision,
  listDecisions,
  getDecisionById,
  listDecisionsByNotificationId,
  async listDecisionsByTraceId(traceId, limit) {
    if (!traceId) throw new Error('traceId required');
    const db = getDb();
    const cap = typeof limit === 'number' ? limit : 50;
    let query = db.collection(COLLECTION)
      .where('traceId', '==', traceId)
      .orderBy('decidedAt', 'desc');
    if (cap) query = query.limit(cap);
    const snap = await query.get();
    return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  }
};
