'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'automation_config';

function resolveTimestamp() {
  return serverTimestamp();
}

async function appendAutomationConfig(data) {
  const payload = data || {};
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const record = Object.assign({}, payload, { createdAt: resolveTimestamp() });
  await docRef.set(record, { merge: false });
  return { id: docRef.id };
}

async function getLatestAutomationConfig() {
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (!snap.docs.length) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

module.exports = {
  appendAutomationConfig,
  getLatestAutomationConfig
};
