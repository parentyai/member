'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

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
  let query = db.collection(COLLECTION);
  if (opts.status) query = query.where('status', '==', opts.status);
  if (opts.scenarioKey) query = query.where('scenarioKey', '==', opts.scenarioKey);
  if (opts.stepKey) query = query.where('stepKey', '==', opts.stepKey);
  query = query.orderBy('createdAt', 'desc');
  const limit = typeof opts.limit === 'number' ? opts.limit : 50;
  if (limit) query = query.limit(limit);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
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
