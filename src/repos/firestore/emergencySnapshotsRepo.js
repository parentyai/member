'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { toMillis } = require('../../usecases/emergency/utils');

const COLLECTION = 'emergency_snapshots';

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizePayloadSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.assign({}, value);
}

async function saveSnapshot(snapshotId, data) {
  const id = typeof snapshotId === 'string' && snapshotId.trim() ? snapshotId.trim() : null;
  if (!id) throw new Error('snapshotId required');
  const payload = data && typeof data === 'object' ? data : {};
  const record = {
    providerKey: normalizeString(payload.providerKey),
    fetchedAt: payload.fetchedAt || null,
    statusCode: Number.isFinite(Number(payload.statusCode)) ? Number(payload.statusCode) : null,
    etag: normalizeString(payload.etag),
    lastModified: normalizeString(payload.lastModified),
    payloadHash: normalizeString(payload.payloadHash),
    payloadPath: normalizeString(payload.payloadPath),
    payloadSummary: normalizePayloadSummary(payload.payloadSummary),
    rawPayload: payload.rawPayload === undefined ? null : payload.rawPayload,
    runId: normalizeString(payload.runId),
    traceId: normalizeString(payload.traceId),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await getDb().collection(COLLECTION).doc(id).set(record, { merge: true });
  return { id };
}

async function getSnapshot(snapshotId) {
  const id = typeof snapshotId === 'string' && snapshotId.trim() ? snapshotId.trim() : null;
  if (!id) throw new Error('snapshotId required');
  const snap = await getDb().collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

function sortByFetchedAtDesc(rows) {
  return (rows || []).slice().sort((a, b) => toMillis(b && b.fetchedAt) - toMillis(a && a.fetchedAt));
}

async function listSnapshotsByProvider(providerKey, limit) {
  const key = typeof providerKey === 'string' && providerKey.trim() ? providerKey.trim().toLowerCase() : null;
  if (!key) throw new Error('providerKey required');
  const max = Number.isFinite(Number(limit)) ? Math.min(Math.max(Math.floor(Number(limit)), 1), 200) : 50;
  const snap = await getDb().collection(COLLECTION).where('providerKey', '==', key).limit(max).get();
  return sortByFetchedAtDesc(snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()))).slice(0, max);
}

async function getLatestSnapshotByProvider(providerKey) {
  const list = await listSnapshotsByProvider(providerKey, 1);
  return list.length ? list[0] : null;
}

module.exports = {
  saveSnapshot,
  getSnapshot,
  listSnapshotsByProvider,
  getLatestSnapshotByProvider
};
