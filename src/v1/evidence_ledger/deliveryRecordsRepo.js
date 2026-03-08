'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'delivery_records';

async function appendDeliveryRecord(entry) {
  const payload = entry && typeof entry === 'object' ? entry : {};
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(payload.id || `delivery_${crypto.randomUUID()}`);
  await docRef.set(Object.assign({}, payload, {
    createdAt: payload.createdAt || serverTimestamp(),
    updatedAt: payload.updatedAt || serverTimestamp()
  }), { merge: true });
  return { id: docRef.id };
}

module.exports = {
  COLLECTION,
  appendDeliveryRecord
};
