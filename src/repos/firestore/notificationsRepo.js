'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'notifications';

function resolveTimestamp(at) {
  return at || serverTimestamp();
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function sortByCreatedAtDesc(rows) {
  return rows.slice().sort((a, b) => toMillis(b && b.createdAt) - toMillis(a && a.createdAt));
}

function hasSeedArchivedAt(row) {
  if (!row || typeof row !== 'object') return false;
  const value = row.seedArchivedAt;
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

async function createNotification(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const payload = Object.assign({}, data || {}, { createdAt: resolveTimestamp(data && data.createdAt) });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

async function getNotification(id) {
  if (!id) throw new Error('notification id required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listNotifications(params) {
  const db = getDb();
  const opts = params || {};
  let baseQuery = db.collection(COLLECTION);
  if (opts.status) baseQuery = baseQuery.where('status', '==', opts.status);
  if (opts.scenarioKey) baseQuery = baseQuery.where('scenarioKey', '==', opts.scenarioKey);
  if (opts.stepKey) baseQuery = baseQuery.where('stepKey', '==', opts.stepKey);
  const limit = typeof opts.limit === 'number' ? opts.limit : 50;
  let query = baseQuery;
  if (limit) query = query.limit(limit);
  const snap = await query.get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  const sorted = sortByCreatedAtDesc(rows);
  const filtered = opts.includeArchivedSeed === true
    ? sorted
    : sorted.filter((row) => !hasSeedArchivedAt(row));
  return limit ? filtered.slice(0, limit) : filtered;
}

async function updateNotificationStatus(id, statusPatch) {
  if (!id) throw new Error('notification id required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  await docRef.set(statusPatch || {}, { merge: true });
  return { id };
}

async function listNotificationsBySeedTag(params) {
  const db = getDb();
  const opts = params && typeof params === 'object' ? params : {};
  const seedTag = typeof opts.seedTag === 'string' ? opts.seedTag.trim() : '';
  if (!seedTag) throw new Error('seedTag required');
  const seedRunId = typeof opts.seedRunId === 'string' ? opts.seedRunId.trim() : '';
  const limit = Number.isFinite(Number(opts.limit)) ? Math.max(1, Math.min(2000, Math.floor(Number(opts.limit)))) : 500;
  let query = db.collection(COLLECTION).where('seedTag', '==', seedTag);
  if (seedRunId) query = query.where('seedRunId', '==', seedRunId);
  query = query.limit(limit);
  const snap = await query.get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  const sorted = sortByCreatedAtDesc(rows);
  if (opts.includeArchivedSeed === true) return sorted;
  return sorted.filter((row) => !hasSeedArchivedAt(row));
}

async function markNotificationsSeedArchived(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const ids = Array.isArray(payload.ids) ? payload.ids.filter((id) => typeof id === 'string' && id.trim()) : [];
  if (!ids.length) return { updatedCount: 0 };
  const patch = payload.patch && typeof payload.patch === 'object' ? payload.patch : {};
  const db = getDb();
  for (const id of ids) {
    await db.collection(COLLECTION).doc(id.trim()).set(patch, { merge: true });
  }
  return { updatedCount: ids.length };
}

module.exports = {
  createNotification,
  getNotification,
  listNotifications,
  updateNotificationStatus,
  listNotificationsBySeedTag,
  markNotificationsSeedArchived
};
