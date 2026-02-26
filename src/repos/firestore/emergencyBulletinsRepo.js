'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { toMillis, stableKey } = require('../../usecases/emergency/utils');

const COLLECTION = 'emergency_bulletins';
const ALLOWED_STATUS = new Set(['draft', 'approved', 'sent', 'rejected']);

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
    regionKey: normalizeString(payload.regionKey),
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
  if (opts.status) query = query.where('status', '==', normalizeStatus(opts.status));
  if (opts.regionKey) query = query.where('regionKey', '==', String(opts.regionKey).trim().toLowerCase());
  const snap = await query.limit(limit).get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  return sortByUpdatedAtDesc(rows).slice(0, limit);
}

module.exports = {
  createBulletin,
  ensureDraftByDiff,
  resolveDraftIdFromDiff,
  getBulletin,
  updateBulletin,
  listBulletins
};
