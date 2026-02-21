'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { isMissingIndexError, sortByTimestampDesc } = require('./queryFallback');
const { recordMissingIndexFallback, shouldFailOnMissingIndex } = require('./indexFallbackPolicy');

const COLLECTION = 'notifications';

function resolveTimestamp(at) {
  return at || serverTimestamp();
}

async function createNotification(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const payload = Object.assign({}, data || {}, { createdAt: resolveTimestamp(data && data.createdAt) });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

async function getNotification(id) {
  if (!id) throw new Error('notification id required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listNotifications(params) {
  const db = getDb();
  const opts = params || {};
  let baseQuery = db.collection(COLLECTION);
  if (opts.status) baseQuery = baseQuery.where('status', '==', opts.status);
  if (opts.scenarioKey) baseQuery = baseQuery.where('scenarioKey', '==', opts.scenarioKey);
  if (opts.stepKey) baseQuery = baseQuery.where('stepKey', '==', opts.stepKey);
  let query = baseQuery.orderBy('createdAt', 'desc');
  const limit = typeof opts.limit === 'number' ? opts.limit : 50;
  if (limit) query = query.limit(limit);
  try {
    const snap = await query.get();
    return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    recordMissingIndexFallback({
      repo: 'notificationsRepo',
      query: 'listNotifications',
      err
    });
    if (shouldFailOnMissingIndex()) throw err;
    // Fallback for environments without composite indexes.
    const snap = await baseQuery.get();
    const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    sortByTimestampDesc(rows, 'createdAt');
    return limit ? rows.slice(0, limit) : rows;
  }
}

async function updateNotificationStatus(id, statusPatch) {
  if (!id) throw new Error('notification id required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  await docRef.set(statusPatch || {}, { merge: true });
  return { id };
}

module.exports = {
  createNotification,
  getNotification,
  listNotifications,
  updateNotificationStatus
};
