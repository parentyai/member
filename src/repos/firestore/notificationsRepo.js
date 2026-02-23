'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'notifications';

function resolveTimestamp(at) {
  return at || serverTimestamp();
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function sortByCreatedAtDesc(rows) {
  return rows.slice().sort((a, b) => toMillis(b && b.createdAt) - toMillis(a && a.createdAt));
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
  const limit = typeof opts.limit === 'number' ? opts.limit : 50;
  let query = baseQuery;
  if (limit) query = query.limit(limit);
  const snap = await query.get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  const sorted = sortByCreatedAtDesc(rows);
  return limit ? sorted.slice(0, limit) : sorted;
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
