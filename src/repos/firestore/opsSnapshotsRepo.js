'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'ops_read_model_snapshots';

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} required`);
  return value.trim();
}

function buildDocId(snapshotType, snapshotKey) {
  return `${snapshotType}__${snapshotKey}`;
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

module.exports = {
  saveSnapshot,
  getSnapshot
};
