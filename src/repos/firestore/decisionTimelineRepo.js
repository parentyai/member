'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'decision_timeline';

function resolveTimestamp() {
  return serverTimestamp();
}

async function appendTimelineEntry(data) {
  const payload = data || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');
  if (!payload.source) throw new Error('source required');
  if (!payload.action) throw new Error('action required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const record = Object.assign({}, payload, { createdAt: resolveTimestamp() });
  await docRef.set(record, { merge: false });
  return { id: docRef.id };
}

async function listTimelineEntries(lineUserId, limit) {
  if (!lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  let query = db.collection(COLLECTION)
    .where('lineUserId', '==', lineUserId)
    .orderBy('createdAt', 'desc');
  const cap = typeof limit === 'number' ? limit : 20;
  if (cap) query = query.limit(cap);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

async function listTimelineByNotificationId(notificationId, limit) {
  if (!notificationId) throw new Error('notificationId required');
  const db = getDb();
  let query = db.collection(COLLECTION)
    .where('notificationId', '==', notificationId)
    .orderBy('createdAt', 'desc');
  const cap = typeof limit === 'number' ? limit : 50;
  if (cap) query = query.limit(cap);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  appendTimelineEntry,
  listTimelineEntries,
  listTimelineByNotificationId,
  async listTimelineEntriesByTraceId(traceId, limit) {
    if (!traceId) throw new Error('traceId required');
    const db = getDb();
    let query = db.collection(COLLECTION)
      .where('traceId', '==', traceId)
      .orderBy('createdAt', 'desc');
    const cap = typeof limit === 'number' ? limit : 50;
    if (cap) query = query.limit(cap);
    const snap = await query.get();
    return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  }
};
