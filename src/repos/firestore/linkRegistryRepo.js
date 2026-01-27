'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'link_registry';

function resolveTimestamp(at) {
  return at || serverTimestamp();
}

async function createLink(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const payload = Object.assign({}, data || {}, { createdAt: resolveTimestamp(data && data.createdAt) });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

async function updateLink(id, patch) {
  if (!id) throw new Error('link id required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  await docRef.set(patch || {}, { merge: true });
  return { id };
}

async function getLink(id) {
  if (!id) throw new Error('link id required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listLinks(params) {
  const db = getDb();
  const opts = params || {};
  let query = db.collection(COLLECTION);
  if (opts.state) query = query.where('lastHealth.state', '==', opts.state);
  query = query.orderBy('createdAt', 'desc');
  const limit = typeof opts.limit === 'number' ? opts.limit : 50;
  if (limit) query = query.limit(limit);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

async function setHealth(id, health) {
  if (!id) throw new Error('link id required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const payload = { lastHealth: Object.assign({}, health, { checkedAt: resolveTimestamp(health && health.checkedAt) }) };
  await docRef.set(payload, { merge: true });
  return { id };
}

module.exports = {
  createLink,
  getLink,
  updateLink,
  listLinks,
  setHealth
};
