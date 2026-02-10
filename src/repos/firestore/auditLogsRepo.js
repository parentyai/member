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
    // NOTE:
    // Avoid composite-index dependency (traceId + createdAt) by not using orderBy.
    // We sort in-memory by createdAt desc for deterministic output.
    let query = db.collection(COLLECTION).where('traceId', '==', traceId);
    const cap = typeof limit === 'number' ? limit : 50;
    if (cap) query = query.limit(cap);
    const snap = await query.get();
    const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    rows.sort((a, b) => {
      const atA = a && a.createdAt;
      const atB = b && b.createdAt;
      const msA = atA && typeof atA.toMillis === 'function' ? atA.toMillis() : Date.parse(String(atA || '')) || 0;
      const msB = atB && typeof atB.toMillis === 'function' ? atB.toMillis() : Date.parse(String(atB || '')) || 0;
      if (msA !== msB) return msB - msA;
      return String(b && b.id || '').localeCompare(String(a && a.id || ''));
    });
    return rows;
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
