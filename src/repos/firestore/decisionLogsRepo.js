'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { isMissingIndexError, sortByTimestampDesc } = require('./queryFallback');
const { recordMissingIndexFallback, shouldFailOnMissingIndex } = require('./indexFallbackPolicy');

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
  try {
    const snap = await baseQuery.orderBy('decidedAt', 'desc').limit(1).get();
    if (!snap.docs.length) return null;
    const doc = snap.docs[0];
    return Object.assign({ id: doc.id }, doc.data());
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    recordMissingIndexFallback({
      repo: 'decisionLogsRepo',
      query: 'getLatestDecision',
      err
    });
    if (shouldFailOnMissingIndex()) throw err;
    const snap = await baseQuery.get();
    const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    sortByTimestampDesc(rows, 'decidedAt');
    return rows.length ? rows[0] : null;
  }
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
  try {
    const snap = await query.get();
    return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    recordMissingIndexFallback({
      repo: 'decisionLogsRepo',
      query: 'listDecisions',
      err
    });
    if (shouldFailOnMissingIndex()) throw err;
    const snap = await baseQuery.get();
    const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    sortByTimestampDesc(rows, 'decidedAt');
    return cap ? rows.slice(0, cap) : rows;
  }
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
  try {
    const snap = await query.get();
    return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    recordMissingIndexFallback({
      repo: 'decisionLogsRepo',
      query: 'listDecisionsByNotificationId',
      err
    });
    if (shouldFailOnMissingIndex()) throw err;
    const snap = await baseQuery.get();
    const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    sortByTimestampDesc(rows, 'decidedAt');
    if (dir === 'asc') rows.reverse();
    return cap ? rows.slice(0, cap) : rows;
  }
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
