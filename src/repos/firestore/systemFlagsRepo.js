'use strict';

const { getDb } = require('../../infra/firestore');

const COLLECTION = 'system_flags';
const DOC_ID = 'phase0';

function normalizeServicePhase(value) {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < 1 || num > 4) return null;
  return num;
}

function normalizeNotificationPreset(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (upper === 'A' || upper === 'B' || upper === 'C') return upper;
  return null;
}

async function getKillSwitch() {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await docRef.get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  return Boolean(data.killSwitch);
}

async function setKillSwitch(isOn) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  await docRef.set({ killSwitch: Boolean(isOn) }, { merge: true });
  return { id: DOC_ID, killSwitch: Boolean(isOn) };
}

async function getServicePhase() {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return normalizeServicePhase(data.servicePhase);
}

async function setServicePhase(servicePhase) {
  const normalized = normalizeServicePhase(servicePhase);
  if (normalized === null) throw new Error('invalid servicePhase');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  await docRef.set({ servicePhase: normalized }, { merge: true });
  return { id: DOC_ID, servicePhase: normalized };
}

async function getNotificationPreset() {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return normalizeNotificationPreset(data.notificationPreset);
}

async function setNotificationPreset(notificationPreset) {
  const normalized = normalizeNotificationPreset(notificationPreset);
  if (normalized === null) throw new Error('invalid notificationPreset');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  await docRef.set({ notificationPreset: normalized }, { merge: true });
  return { id: DOC_ID, notificationPreset: normalized };
}

module.exports = {
  getKillSwitch,
  setKillSwitch,
  getServicePhase,
  setServicePhase,
  getNotificationPreset,
  setNotificationPreset
};
