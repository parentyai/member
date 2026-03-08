'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { isMissingIndexError: hasMissingIndexError } = require('./queryFallback');
const { shouldFailOnMissingIndex, recordMissingIndexFallback } = require('./indexFallbackPolicy');

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

function normalizePositiveInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (Number.isFinite(min) && normalized < min) return fallback;
  if (Number.isFinite(max) && normalized > max) return fallback;
  return normalized;
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
  },
  async listEventsByType(filters) {
    const opts = filters && typeof filters === 'object' ? filters : {};
    const type = typeof opts.type === 'string' ? opts.type.trim() : '';
    if (!type) throw new Error('type required');
    const lineUserId = typeof opts.lineUserId === 'string' ? opts.lineUserId.trim() : '';
    const todoKey = typeof opts.todoKey === 'string' ? opts.todoKey.trim() : '';
    const limit = normalizePositiveInt(opts.limit, 20, 1, 200);
    const scanLimit = normalizePositiveInt(opts.scanLimit, Math.min(limit * 5, 1000), limit, 2000);
    const db = getDb();

    const applyTodoFilter = (rows) => {
      if (!todoKey) return rows;
      return rows.filter((row) => {
        const ref = row && row.ref && typeof row.ref === 'object' ? row.ref : {};
        return typeof ref.todoKey === 'string' && ref.todoKey.trim() === todoKey;
      });
    };

    let rows = [];
    try {
      let query = db.collection(COLLECTION).where('type', '==', type);
      if (lineUserId) query = query.where('lineUserId', '==', lineUserId);
      query = query.orderBy('createdAt', 'desc').limit(scanLimit);
      const snap = await query.get();
      rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    } catch (err) {
      if (!hasMissingIndexError(err)) throw err;
      recordMissingIndexFallback({
        repo: 'eventsRepo',
        query: 'listEventsByType',
        err
      });
      if (shouldFailOnMissingIndex()) throw err;
      let fallbackQuery = db.collection(COLLECTION);
      if (lineUserId) fallbackQuery = fallbackQuery.where('lineUserId', '==', lineUserId);
      fallbackQuery = fallbackQuery.orderBy('createdAt', 'desc').limit(scanLimit);
      const snap = await fallbackQuery.get();
      rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()))
        .filter((row) => String(row && row.type || '') === type);
    }

    rows.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return applyTodoFilter(rows).slice(0, limit);
  }
};
