'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'notification_deliveries';

function resolveTimestamp(at) {
  return at || serverTimestamp();
}

async function createDelivery(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const payload = Object.assign({}, data || {}, { sentAt: resolveTimestamp(data && data.sentAt) });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

async function getDelivery(deliveryId) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function markRead(deliveryId, at) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  await docRef.set({ readAt: resolveTimestamp(at) }, { merge: true });
  return { id: deliveryId };
}

async function markClick(deliveryId, at) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  await docRef.set({ clickAt: resolveTimestamp(at) }, { merge: true });
  return { id: deliveryId };
}

async function listDeliveriesByUser(lineUserId, limit) {
  if (!lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  let query = db.collection(COLLECTION).where('lineUserId', '==', lineUserId).orderBy('sentAt', 'desc');
  const max = typeof limit === 'number' ? limit : 50;
  if (max) query = query.limit(max);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

async function listDeliveriesByNotificationId(notificationId) {
  if (!notificationId) throw new Error('notificationId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('notificationId', '==', notificationId).get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  createDelivery,
  getDelivery,
  markRead,
  markClick,
  listDeliveriesByUser,
  listDeliveriesByNotificationId
};
