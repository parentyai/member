'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { toMillis } = require('../../usecases/emergency/utils');

const COLLECTION = 'emergency_events_normalized';

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeSeverity(value) {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (raw === 'CRITICAL' || raw === 'WARN' || raw === 'INFO') return raw;
  return 'INFO';
}

async function upsertEvent(eventDocId, data) {
  const id = typeof eventDocId === 'string' && eventDocId.trim() ? eventDocId.trim() : null;
  if (!id) throw new Error('eventDocId required');
  const payload = data && typeof data === 'object' ? data : {};
  await getDb().collection(COLLECTION).doc(id).set({
    providerKey: normalizeString(payload.providerKey),
    eventKey: normalizeString(payload.eventKey),
    regionKey: normalizeString(payload.regionKey),
    severity: normalizeSeverity(payload.severity),
    category: normalizeString(payload.category),
    startsAt: payload.startsAt || null,
    endsAt: payload.endsAt || null,
    headline: normalizeString(payload.headline),
    officialLinkRegistryId: normalizeString(payload.officialLinkRegistryId),
    snapshotId: normalizeString(payload.snapshotId),
    runId: normalizeString(payload.runId),
    traceId: normalizeString(payload.traceId),
    eventHash: normalizeString(payload.eventHash),
    isActive: payload.isActive !== false,
    resolvedAt: payload.resolvedAt || null,
    rawMeta: payload.rawMeta || null,
    updatedAt: serverTimestamp(),
    createdAt: payload.createdAt || serverTimestamp()
  }, { merge: true });
  return { id };
}

async function getEvent(eventDocId) {
  const id = typeof eventDocId === 'string' && eventDocId.trim() ? eventDocId.trim() : null;
  if (!id) throw new Error('eventDocId required');
  const snap = await getDb().collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

function sortByUpdatedAtDesc(rows) {
  return (rows || []).slice().sort((a, b) => toMillis(b && b.updatedAt) - toMillis(a && a.updatedAt));
}

async function listEventsByProvider(providerKey, limit) {
  const key = typeof providerKey === 'string' && providerKey.trim() ? providerKey.trim().toLowerCase() : null;
  if (!key) throw new Error('providerKey required');
  const max = Number.isFinite(Number(limit)) ? Math.min(Math.max(Math.floor(Number(limit)), 1), 3000) : 1000;
  const snap = await getDb().collection(COLLECTION).where('providerKey', '==', key).limit(max).get();
  return sortByUpdatedAtDesc(snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()))).slice(0, max);
}

module.exports = {
  upsertEvent,
  getEvent,
  listEventsByProvider
};
