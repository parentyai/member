'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { ALLOWED_MODULES } = require('./cityPacksRepo');

const COLLECTION = 'city_pack_bulletins';
const ALLOWED_STATUS = new Set(['draft', 'approved', 'sent', 'rejected']);
const ALLOWED_MODULE_SET = new Set(ALLOWED_MODULES);

function normalizeStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_STATUS.has(status) ? status : 'draft';
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeModules(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((value) => {
    if (typeof value !== 'string') return;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;
    if (!ALLOWED_MODULE_SET.has(normalized)) return;
    if (out.includes(normalized)) return;
    out.push(normalized);
  });
  return out;
}

function resolveId(payload) {
  if (payload && typeof payload.id === 'string' && payload.id.trim()) return payload.id.trim();
  return `cpb_${crypto.randomUUID()}`;
}

function normalizePayload(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const origin = normalizeString(payload.origin) || 'manual';
  return {
    id: resolveId(payload),
    status: normalizeStatus(payload.status),
    cityPackId: normalizeString(payload.cityPackId),
    notificationId: normalizeString(payload.notificationId),
    summary: normalizeString(payload.summary),
    traceId: normalizeString(payload.traceId),
    requestId: normalizeString(payload.requestId),
    sourceRefId: normalizeString(payload.sourceRefId),
    modulesUpdated: normalizeModules(payload.modulesUpdated),
    origin
  };
}

async function createBulletin(data) {
  const payload = normalizePayload(data);
  if (!payload.cityPackId) throw new Error('cityPackId required');
  if (!payload.summary) throw new Error('summary required');
  if (!payload.traceId) throw new Error('traceId required');
  if (payload.status !== 'draft' && !payload.notificationId) throw new Error('notificationId required');
  const db = getDb();
  await db.collection(COLLECTION).doc(payload.id).set({
    status: payload.status,
    cityPackId: payload.cityPackId,
    notificationId: payload.notificationId,
    summary: payload.summary,
    traceId: payload.traceId,
    requestId: payload.requestId,
    sourceRefId: payload.sourceRefId,
    modulesUpdated: payload.modulesUpdated,
    origin: payload.origin,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    approvedAt: null,
    sentAt: null,
    deliveredCount: null,
    llm_used: false,
    model: null,
    promptVersion: null
  }, { merge: false });
  return { id: payload.id };
}

async function getBulletin(bulletinId) {
  if (!bulletinId) throw new Error('bulletinId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(bulletinId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function updateBulletin(bulletinId, patch) {
  if (!bulletinId) throw new Error('bulletinId required');
  const payload = patch && typeof patch === 'object' ? Object.assign({}, patch) : {};
  payload.updatedAt = serverTimestamp();
  const db = getDb();
  await db.collection(COLLECTION).doc(bulletinId).set(payload, { merge: true });
  return { id: bulletinId };
}

async function listBulletins(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(opts.limit)) ? Math.min(Math.max(Math.floor(Number(opts.limit)), 1), 200) : 50;
  let baseQuery = getDb().collection(COLLECTION);
  if (opts.status) baseQuery = baseQuery.where('status', '==', normalizeStatus(opts.status));
  const snap = await baseQuery.orderBy('updatedAt', 'desc').limit(limit).get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  return rows;
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

async function listBulletinsByTraceId(traceId, limit) {
  const normalizedTraceId = normalizeString(traceId);
  if (!normalizedTraceId) throw new Error('traceId required');
  const cap = Number.isFinite(Number(limit)) ? Math.min(Math.max(Math.floor(Number(limit)), 1), 200) : 50;
  const snap = await getDb().collection(COLLECTION).where('traceId', '==', normalizedTraceId).limit(cap).get();
  return snap.docs
    .map((doc) => Object.assign({ id: doc.id }, doc.data()))
    .sort((a, b) => toMillis(b && b.updatedAt) - toMillis(a && a.updatedAt))
    .slice(0, cap);
}

module.exports = {
  normalizeStatus,
  createBulletin,
  getBulletin,
  updateBulletin,
  listBulletins,
  listBulletinsByTraceId
};
