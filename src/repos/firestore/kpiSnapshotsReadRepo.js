'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'phase22_kpi_snapshots';

function normalizeOrder(value) {
  return value === 'asc' ? 'asc' : 'desc';
}

function normalizeLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 20;
  const rounded = Math.max(1, Math.floor(num));
  return Math.min(200, rounded);
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function compareDates(a, b, order) {
  const aDate = parseDate(a);
  const bDate = parseDate(b);
  const aMissing = !aDate;
  const bMissing = !bDate;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  const diff = aDate.getTime() - bDate.getTime();
  return order === 'asc' ? diff : -diff;
}

async function listSnapshots(params) {
  const opts = params || {};
  const db = getDb();
  let query = db.collection(COLLECTION);

  if (opts.ctaA) query = query.where('ctaA', '==', opts.ctaA);
  if (opts.ctaB) query = query.where('ctaB', '==', opts.ctaB);

  const order = normalizeOrder(opts.order);
  query = query.orderBy('createdAt', order);

  const limit = normalizeLimit(opts.limit);
  if (limit) query = query.limit(limit);

  const snap = await query.get();
  let docs = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));

  const fromDate = parseDate(opts.from);
  const toDate = parseDate(opts.to);

  if (fromDate || toDate) {
    docs = docs.filter((doc) => {
      const fromUtc = parseDate(doc.fromUtc);
      const toUtc = parseDate(doc.toUtc);
      if (fromDate && (!fromUtc || fromUtc < fromDate)) return false;
      if (toDate && (!toUtc || toUtc > toDate)) return false;
      return true;
    });
  }

  docs.sort((a, b) => compareDates(a.createdAt, b.createdAt, order));

  return docs;
}

async function upsertSnapshot(docId, record) {
  if (!docId) throw new Error('docId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(docId);
  const payload = Object.assign({}, record || {}, { createdAt: serverTimestamp() });
  await docRef.set(payload, { merge: true });
  return { id: docRef.id };
}

module.exports = {
  listSnapshots,
  upsertSnapshot
};
