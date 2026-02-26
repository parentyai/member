'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { stableKey, toMillis } = require('../../usecases/emergency/utils');

const COLLECTION = 'emergency_unmapped_events';

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveId(payload) {
  const providerKey = normalizeString(payload && payload.providerKey) || 'provider';
  const eventKey = normalizeString(payload && payload.eventKey) || 'event';
  const snapshotId = normalizeString(payload && payload.snapshotId) || 'snapshot';
  return `emu_${stableKey([providerKey, eventKey, snapshotId])}`;
}

async function saveUnmappedEvent(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const id = resolveId(payload);
  await getDb().collection(COLLECTION).doc(id).set({
    providerKey: normalizeString(payload.providerKey),
    eventKey: normalizeString(payload.eventKey),
    reason: normalizeString(payload.reason) || 'region_unresolved',
    snapshotId: normalizeString(payload.snapshotId),
    runId: normalizeString(payload.runId),
    traceId: normalizeString(payload.traceId),
    rawMeta: payload.rawMeta || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { id };
}

function sortByCreatedAtDesc(rows) {
  return (rows || []).slice().sort((a, b) => toMillis(b && b.createdAt) - toMillis(a && a.createdAt));
}

async function listUnmappedBySnapshot(snapshotId, limit) {
  const key = typeof snapshotId === 'string' && snapshotId.trim() ? snapshotId.trim() : null;
  if (!key) throw new Error('snapshotId required');
  const max = Number.isFinite(Number(limit)) ? Math.min(Math.max(Math.floor(Number(limit)), 1), 200) : 50;
  const snap = await getDb().collection(COLLECTION).where('snapshotId', '==', key).limit(max).get();
  return sortByCreatedAtDesc(snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()))).slice(0, max);
}

module.exports = {
  saveUnmappedEvent,
  listUnmappedBySnapshot
};
