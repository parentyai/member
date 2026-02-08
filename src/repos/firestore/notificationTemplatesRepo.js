'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'notification_templates';

function resolveTimestamp() {
  return serverTimestamp();
}

async function createTemplate(data) {
  const payload = data || {};
  if (!payload.key) throw new Error('key required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const record = Object.assign({}, payload, { createdAt: resolveTimestamp() });
  await docRef.set(record, { merge: false });
  return { id: docRef.id };
}

async function listTemplates(limit) {
  const db = getDb();
  let query = db.collection(COLLECTION).orderBy('createdAt', 'desc');
  const cap = typeof limit === 'number' ? limit : 50;
  if (cap) query = query.limit(cap);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

async function getTemplateByKey(key) {
  if (!key) throw new Error('key required');
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .where('key', '==', key)
    .limit(1)
    .get();
  if (!snap.docs.length) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

module.exports = {
  createTemplate,
  listTemplates,
  getTemplateByKey
};
