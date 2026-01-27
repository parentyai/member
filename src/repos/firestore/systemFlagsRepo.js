'use strict';

const { getDb } = require('../../infra/firestore');

const COLLECTION = 'system_flags';
const DOC_ID = 'phase0';

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

module.exports = {
  getKillSwitch,
  setKillSwitch
};
