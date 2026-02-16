'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'events';

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

async function createEvent(data) {
  const payload = data || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');
  if (!payload.type) throw new Error('type required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const record = Object.assign({}, payload, { createdAt: serverTimestamp() });
  await docRef.set(record, { merge: false });
  return { id: docRef.id };
}

module.exports = {
  createEvent,
  async listEventsByUser(lineUserId, limit) {
    if (!lineUserId) throw new Error('lineUserId required');
    const db = getDb();
    let query = db.collection(COLLECTION).where('lineUserId', '==', lineUserId);
    query = query.orderBy('createdAt', 'desc');
    const cap = typeof limit === 'number' ? limit : 50;
    if (cap) query = query.limit(cap);
    const snap = await query.get();
    const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    rows.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return rows;
  }
};
