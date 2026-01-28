'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'checklists';

async function createChecklist(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const payload = Object.assign({}, data || {}, { createdAt: serverTimestamp() });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

async function getChecklist(id) {
  if (!id) throw new Error('checklistId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listChecklists(params) {
  const db = getDb();
  const opts = params || {};
  let query = db.collection(COLLECTION);
  if (opts.scenario) query = query.where('scenario', '==', opts.scenario);
  if (opts.step) query = query.where('step', '==', opts.step);
  query = query.orderBy('createdAt', 'desc');
  const limit = typeof opts.limit === 'number' ? opts.limit : 50;
  if (limit) query = query.limit(limit);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  createChecklist,
  getChecklist,
  listChecklists
};
