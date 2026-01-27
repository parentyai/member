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

module.exports = {
  createDelivery,
  markRead,
  markClick
};
