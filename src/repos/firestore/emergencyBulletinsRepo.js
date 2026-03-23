'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { toMillis, stableKey } = require('../../usecases/emergency/utils');
const { normalizeState } = require('../../domain/regionNormalization');

const COLLECTION = 'emergency_bulletins';
const ALLOWED_STATUS = new Set(['draft', 'approved', 'sent', 'rejected']);

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function canonicalizeRegionKey(value) {
  const raw = normalizeString(value);
  if (!raw) return null;
  const parts = raw.split('::');
  if (parts.length !== 2) return raw;
  const state = normalizeState(parts[0]) || String(parts[0]).trim().toUpperCase();
  const scope = String(parts[1]).trim().toLowerCase();
  if (!state || !scope) return raw;
  return `${state}::${scope}`;
}

function normalizeStatus(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return 'draft';
  return ALLOWED_STATUS.has(raw) ? raw : 'draft';
}

function normalizeSeverity(value) {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (raw === 'CRITICAL' || raw === 'WARN' || raw === 'INFO') return raw;
  return 'INFO';
}

function resolveId(payload) {
  if (payload && typeof payload.id === 'string' && payload.id.trim()) return payload.id.trim();
  return `emb_${crypto.randomUUID()}`;
}

function normalizeEvidenceRefs(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.assign({}, value);
}

async function createBulletin(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const id = resolveId(payload);
  await getDb().collection(COLLECTION).doc(id).set({
    status: normalizeStatus(payload.status),
    regionKey: canonicalizeRegionKey(payload.regionKey),
    category: normalizeString(payload.category),
    severity: normalizeSeverity(payload.severity),
    linkRegistryId: normalizeString(payload.linkRegistryId),
    messageDraft: normalizeString(payload.messageDraft),
    evidenceRefs: normalizeEvidenceRefs(payload.evidenceRefs),
    providerKey: normalizeString(payload.providerKey),
    headline: normalizeString(payload.headline),
    traceId: normalizeString(payload.traceId),
    approvedBy: normalizeString(payload.approvedBy),
    approvedAt: payload.approvedAt || null,
    sentAt: payload.sentAt || null,
    sendResult: payload.sendResult || null,
    notificationIds: Array.isArray(payload.notificationIds) ? payload.notificationIds : [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: false });
  return { id };
}

function resolveDraftIdFromDiff(diffId) {
  const key = stableKey(['draft', normalizeString(diffId) || 'unknown']);
  return `emb_draft_${key}`;
}

async function ensureDraftByDiff(diffId, data) {
  const normalizedDiffId = normalizeString(diffId);
  if (!normalizedDiffId) throw new Error('diffId required');
  const id = resolveDraftIdFromDiff(normalizedDiffId);
  const existing = await getBulletin(id);
  if (existing) return { id, created: false };
  await createBulletin(Object.assign({}, data || {}, {
    id,
    status: 'draft',
    evidenceRefs: Object.assign({}, (data && data.evidenceRefs) || {}, { diffId: normalizedDiffId })
  }));
  return { id, created: true };
}

async function getBulletin(bulletinId) {
  const id = typeof bulletinId === 'string' && bulletinId.trim() ? bulletinId.trim() : null;
  if (!id) throw new Error('bulletinId required');
  const snap = await getDb().collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function updateBulletin(bulletinId, patch) {
  const id = typeof bulletinId === 'string' && bulletinId.trim() ? bulletinId.trim() : null;
  if (!id) throw new Error('bulletinId required');
  const payload = patch && typeof patch === 'object' ? Object.assign({}, patch) : {};
  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    payload.status = normalizeStatus(payload.status);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'regionKey')) {
    payload.regionKey = canonicalizeRegionKey(payload.regionKey);
  }
  payload.updatedAt = serverTimestamp();
  await getDb().collection(COLLECTION).doc(id).set(payload, { merge: true });
  return { id };
}

function sortByUpdatedAtDesc(rows) {
  return (rows || []).slice().sort((a, b) => toMillis(b && b.updatedAt) - toMillis(a && a.updatedAt));
}

async function listBulletins(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(opts.limit)) ? Math.min(Math.max(Math.floor(Number(opts.limit)), 1), 300) : 50;
  let query = getDb().collection(COLLECTION);
  const statusFilter = opts.status ? normalizeStatus(opts.status) : null;
  const regionFilter = canonicalizeRegionKey(opts.regionKey);

  // Keep a single where filter to avoid introducing new composite index requirements.
  if (statusFilter) query = query.where('status', '==', statusFilter);
  else if (regionFilter) query = query.where('regionKey', '==', regionFilter);

  const snap = await query.limit(limit).get();
  let rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  if (statusFilter) rows = rows.filter((row) => normalizeStatus(row && row.status) === statusFilter);
  if (regionFilter) {
    rows = rows.filter((row) => {
      const regionKey = canonicalizeRegionKey(row && row.regionKey);
      return regionKey === regionFilter;
    });
  }
  return sortByUpdatedAtDesc(rows).slice(0, limit);
}

async function listBulletinsByTraceId(traceId, limit) {
  const normalizedTraceId = normalizeString(traceId);
  if (!normalizedTraceId) throw new Error('traceId required');
  const cap = Number.isFinite(Number(limit)) ? Math.min(Math.max(Math.floor(Number(limit)), 1), 200) : 50;
  const snap = await getDb().collection(COLLECTION).where('traceId', '==', normalizedTraceId).limit(cap).get();
  return sortByUpdatedAtDesc(snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()))).slice(0, cap);
}

module.exports = {
  canonicalizeRegionKey,
  createBulletin,
  ensureDraftByDiff,
  resolveDraftIdFromDiff,
  getBulletin,
  updateBulletin,
  listBulletins,
  listBulletinsByTraceId
};
