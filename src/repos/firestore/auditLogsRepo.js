'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'audit_logs';

function resolveTimestamp(at) {
  return at || serverTimestamp();
}

async function appendAuditLog(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const payload = Object.assign({}, data || {}, { createdAt: resolveTimestamp(data && data.createdAt) });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

module.exports = {
  appendAuditLog,
  async listAuditLogsByTraceId(traceId, limit) {
    if (!traceId) throw new Error('traceId required');
    const db = getDb();
    let query = db.collection(COLLECTION)
      .where('traceId', '==', traceId)
      .orderBy('createdAt', 'desc');
    const cap = typeof limit === 'number' ? limit : 50;
    if (cap) query = query.limit(cap);
    const snap = await query.get();
    return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  },
  async listAuditLogs(filters) {
    const payload = filters || {};
    const db = getDb();
    let query = db.collection(COLLECTION);
    if (payload.action) query = query.where('action', '==', payload.action);
    if (payload.templateKey) query = query.where('templateKey', '==', payload.templateKey);
    query = query.orderBy('createdAt', 'desc');
    const limit = typeof payload.limit === 'number' ? payload.limit : 20;
    if (limit) query = query.limit(limit);
    const snap = await query.get();
    return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  },
  async getLatestAuditLog(filters) {
    const list = await module.exports.listAuditLogs(Object.assign({}, filters, { limit: 1 }));
    return list.length ? list[0] : null;
  }
};
