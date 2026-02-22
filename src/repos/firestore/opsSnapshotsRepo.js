'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'ops_read_model_snapshots';
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} required`);
  return value.trim();
}

function buildDocId(snapshotType, snapshotKey) {
  return `${snapshotType}__${snapshotKey}`;
}

function resolveListLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.floor(num), MAX_LIST_LIMIT);
}

async function saveSnapshot(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const snapshotType = requireString(payload.snapshotType, 'snapshotType');
  const snapshotKey = requireString(payload.snapshotKey, 'snapshotKey');
  const asOf = payload.asOf || new Date().toISOString();
  const docId = buildDocId(snapshotType, snapshotKey);
  const db = getDb();
  await db.collection(COLLECTION).doc(docId).set({
    snapshotType,
    snapshotKey,
    asOf,
    freshnessMinutes: Number.isFinite(Number(payload.freshnessMinutes)) ? Number(payload.freshnessMinutes) : null,
    sourceTraceId: payload.sourceTraceId || null,
    data: payload.data || null,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true });
  return { id: docId };
}

async function getSnapshot(snapshotType, snapshotKey) {
  const type = requireString(snapshotType, 'snapshotType');
  const key = requireString(snapshotKey, 'snapshotKey');
  const db = getDb();
  const docId = buildDocId(type, key);
  const snap = await db.collection(COLLECTION).doc(docId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: docId }, snap.data());
}

async function listSnapshots(opts) {
  const payload = opts && typeof opts === 'object' ? opts : {};
  const limit = resolveListLimit(payload.limit);
  const db = getDb();
  let query = db.collection(COLLECTION);
  if (typeof payload.snapshotType === 'string' && payload.snapshotType.trim()) {
    query = query.where('snapshotType', '==', payload.snapshotType.trim());
  }
  const snap = await query.orderBy('updatedAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  saveSnapshot,
  getSnapshot,
  listSnapshots
};
