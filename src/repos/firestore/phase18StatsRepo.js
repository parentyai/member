'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'phase18_cta_stats';

function increment(value) {
  const admin = require('firebase-admin');
  return admin.firestore.FieldValue.increment(value);
}

async function incrementSent(params) {
  const payload = params || {};
  if (!payload.notificationId) throw new Error('notificationId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(payload.notificationId);
  const update = {
    notificationId: payload.notificationId,
    ctaText: payload.ctaText || null,
    linkRegistryId: payload.linkRegistryId || null,
    sentCount: increment(1),
    updatedAt: serverTimestamp()
  };
  await docRef.set(update, { merge: true });
  return { id: docRef.id };
}

async function incrementClick(params) {
  const payload = params || {};
  if (!payload.notificationId) throw new Error('notificationId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(payload.notificationId);
  const update = {
    notificationId: payload.notificationId,
    ctaText: payload.ctaText || null,
    linkRegistryId: payload.linkRegistryId || null,
    clickCount: increment(1),
    updatedAt: serverTimestamp()
  };
  await docRef.set(update, { merge: true });
  return { id: docRef.id };
}

module.exports = {
  incrementSent,
  incrementClick
};
