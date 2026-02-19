'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { isMissingIndexError, sortByTimestampDesc } = require('./queryFallback');

const COLLECTION = 'city_pack_bulletins';
const ALLOWED_STATUS = new Set(['draft', 'approved', 'sent', 'rejected']);

function normalizeStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_STATUS.has(status) ? status : 'draft';
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveId(payload) {
  if (payload && typeof payload.id === 'string' && payload.id.trim()) return payload.id.trim();
  return `cpb_${crypto.randomUUID()}`;
}

function normalizePayload(data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    id: resolveId(payload),
    status: normalizeStatus(payload.status),
    cityPackId: normalizeString(payload.cityPackId),
    notificationId: normalizeString(payload.notificationId),
    summary: normalizeString(payload.summary),
    traceId: normalizeString(payload.traceId),
    requestId: normalizeString(payload.requestId)
  };
}

async function createBulletin(data) {
  const payload = normalizePayload(data);
  if (!payload.cityPackId) throw new Error('cityPackId required');
  if (!payload.notificationId) throw new Error('notificationId required');
  if (!payload.summary) throw new Error('summary required');
  if (!payload.traceId) throw new Error('traceId required');
  const db = getDb();
  await db.collection(COLLECTION).doc(payload.id).set({
    status: payload.status,
    cityPackId: payload.cityPackId,
    notificationId: payload.notificationId,
    summary: payload.summary,
    traceId: payload.traceId,
    requestId: payload.requestId,
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
  let rows;
  try {
    const snap = await baseQuery.orderBy('updatedAt', 'desc').limit(limit).get();
    rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    const snap = await baseQuery.get();
    rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    sortByTimestampDesc(rows, 'updatedAt');
    rows = rows.slice(0, limit);
  }
  return rows;
}

module.exports = {
  normalizeStatus,
  createBulletin,
  getBulletin,
  updateBulletin,
  listBulletins
};
