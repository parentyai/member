'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'phase18_cta_stats';
const NOTIFICATIONS_COLLECTION = 'notifications';
const SENT_SLOT_FIELD_MAP = Object.freeze({
  primary: 'sentPrimaryCount',
  secondary1: 'sentSecondary1Count',
  secondary2: 'sentSecondary2Count'
});
const CLICK_SLOT_FIELD_MAP = Object.freeze({
  primary: 'clickPrimaryCount',
  secondary1: 'clickSecondary1Count',
  secondary2: 'clickSecondary2Count'
});

function increment(value) {
  const admin = require('firebase-admin');
  return admin.firestore.FieldValue.increment(value);
}

function normalizeCtaSlot(value) {
  if (typeof value !== 'string') return null;
  const slot = value.trim().toLowerCase();
  if (slot === 'primary' || slot === 'secondary1' || slot === 'secondary2') return slot;
  return null;
}

function normalizeCtaSlots(payload) {
  const values = [];
  if (Array.isArray(payload.ctaSlots)) {
    payload.ctaSlots.forEach((value) => {
      const slot = normalizeCtaSlot(value);
      if (slot) values.push(slot);
    });
  }
  const single = normalizeCtaSlot(payload.ctaSlot);
  if (single) values.push(single);
  return Array.from(new Set(values));
}

async function resolveCreatedAtIfMissing(db, statsDocRef, notificationId) {
  // Best-effort: if we can derive a stable createdAt (from notifications/{id}),
  // store it once so time-range stats can filter reliably.
  const statsSnap = await statsDocRef.get();
  const statsData = statsSnap && statsSnap.exists ? statsSnap.data() : null;
  if (statsData && statsData.createdAt) return null;

  const notifSnap = await db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId).get();
  const notifData = notifSnap && notifSnap.exists ? notifSnap.data() : null;
  if (!notifData || !notifData.createdAt) return null;
  return notifData.createdAt;
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
  const ctaSlots = normalizeCtaSlots(payload);
  ctaSlots.forEach((slot) => {
    const key = SENT_SLOT_FIELD_MAP[slot];
    if (!key) return;
    update[key] = increment(1);
  });
  const createdAt = await resolveCreatedAtIfMissing(db, docRef, payload.notificationId);
  if (createdAt) update.createdAt = createdAt;
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
  const ctaSlots = normalizeCtaSlots(payload);
  ctaSlots.forEach((slot) => {
    const key = CLICK_SLOT_FIELD_MAP[slot];
    if (!key) return;
    update[key] = increment(1);
  });
  const createdAt = await resolveCreatedAtIfMissing(db, docRef, payload.notificationId);
  if (createdAt) update.createdAt = createdAt;
  await docRef.set(update, { merge: true });
  return { id: docRef.id };
}

module.exports = {
  incrementSent,
  incrementClick
};
