'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { toMillis } = require('../../usecases/emergency/utils');

const COLLECTION = 'emergency_diffs';

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveId(payload) {
  if (payload && typeof payload.id === 'string' && payload.id.trim()) return payload.id.trim();
  return `edf_${crypto.randomUUID()}`;
}

function normalizeSeverity(value) {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (raw === 'CRITICAL' || raw === 'WARN' || raw === 'INFO') return raw;
  return 'INFO';
}

function normalizeDiffType(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'new' || raw === 'update' || raw === 'resolve') return raw;
  return 'update';
}

function normalizeChangedKeys(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)));
}

async function createDiff(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const id = resolveId(payload);
  await getDb().collection(COLLECTION).doc(id).set({
    providerKey: normalizeString(payload.providerKey),
    regionKey: normalizeString(payload.regionKey),
    category: normalizeString(payload.category),
    diffType: normalizeDiffType(payload.diffType),
    severity: normalizeSeverity(payload.severity),
    changedKeys: normalizeChangedKeys(payload.changedKeys),
    summaryDraft: normalizeString(payload.summaryDraft),
    snapshotId: normalizeString(payload.snapshotId),
    eventKey: normalizeString(payload.eventKey),
    eventDocId: normalizeString(payload.eventDocId),
    runId: normalizeString(payload.runId),
    traceId: normalizeString(payload.traceId),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: false });
  return { id };
}

async function getDiff(diffId) {
  const id = typeof diffId === 'string' && diffId.trim() ? diffId.trim() : null;
  if (!id) throw new Error('diffId required');
  const snap = await getDb().collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function updateDiff(diffId, patch) {
  const id = typeof diffId === 'string' && diffId.trim() ? diffId.trim() : null;
  if (!id) throw new Error('diffId required');
  const payload = patch && typeof patch === 'object' ? patch : {};
  const record = Object.assign({}, payload, { updatedAt: serverTimestamp() });
  await getDb().collection(COLLECTION).doc(id).set(record, { merge: true });
  return { id };
}

function sortByCreatedAtDesc(rows) {
  return (rows || []).slice().sort((a, b) => toMillis(b && b.createdAt) - toMillis(a && a.createdAt));
}

async function listDiffsByProvider(providerKey, limit) {
  const key = typeof providerKey === 'string' && providerKey.trim() ? providerKey.trim().toLowerCase() : null;
  if (!key) throw new Error('providerKey required');
  const max = Number.isFinite(Number(limit)) ? Math.min(Math.max(Math.floor(Number(limit)), 1), 500) : 100;
  const snap = await getDb().collection(COLLECTION).where('providerKey', '==', key).limit(max).get();
  return sortByCreatedAtDesc(snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()))).slice(0, max);
}

async function listDiffsBySnapshot(snapshotId, limit) {
  const key = typeof snapshotId === 'string' && snapshotId.trim() ? snapshotId.trim() : null;
  if (!key) throw new Error('snapshotId required');
  const max = Number.isFinite(Number(limit)) ? Math.min(Math.max(Math.floor(Number(limit)), 1), 500) : 100;
  const snap = await getDb().collection(COLLECTION).where('snapshotId', '==', key).limit(max).get();
  return sortByCreatedAtDesc(snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()))).slice(0, max);
}

module.exports = {
  createDiff,
  getDiff,
  updateDiff,
  listDiffsByProvider,
  listDiffsBySnapshot
};
