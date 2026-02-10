'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'notification_deliveries';

function resolveTimestamp(at) {
  // Allow explicit null when callers want to indicate "not set yet".
  if (at === null) return null;
  return at || serverTimestamp();
}

async function createDelivery(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const payload = Object.assign({}, data || {}, { sentAt: resolveTimestamp(data && data.sentAt) });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

function reserveDeliveryId() {
  const db = getDb();
  return db.collection(COLLECTION).doc().id;
}

async function createDeliveryWithId(deliveryId, data) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  const payload = Object.assign({}, data || {}, { sentAt: resolveTimestamp(data && data.sentAt) });
  await docRef.set(payload, { merge: true });
  return { id: docRef.id };
}

async function reserveDeliveryWithId(deliveryId, data) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  const reservedAt = resolveTimestamp(data && data.reservedAt);
  // Reserve (create) the delivery doc before sending to prevent duplicates
  // across process crashes. If it already exists, return the existing doc.
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (snap.exists) {
      return { id: deliveryId, existing: Object.assign({ id: deliveryId }, snap.data()) };
    }
    tx.set(docRef, Object.assign({}, data || {}, {
      delivered: false,
      state: 'reserved',
      reservedAt,
      sentAt: null
    }), { merge: false });
    return { id: deliveryId, reserved: true };
  });
  return result;
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
  reserveDeliveryId,
  createDeliveryWithId,
  reserveDeliveryWithId,
  getDelivery,
  markRead,
  markClick,
  listDeliveriesByUser,
  listDeliveriesByNotificationId
};
