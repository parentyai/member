'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { isMissingIndexError, sortByTimestampDesc, toMillis } = require('./queryFallback');

const COLLECTION = 'city_pack_requests';
const ALLOWED_STATUS = new Set([
  'queued',
  'collecting',
  'drafted',
  'needs_review',
  'approved',
  'active',
  'rejected',
  'failed'
]);

function normalizeStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_STATUS.has(status) ? status : 'queued';
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeArray(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())));
}

function resolveId(payload) {
  if (payload && typeof payload.id === 'string' && payload.id.trim()) return payload.id.trim();
  return `cpr_${crypto.randomUUID()}`;
}

function normalizePayload(data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    id: resolveId(payload),
    status: normalizeStatus(payload.status),
    lineUserId: normalizeString(payload.lineUserId),
    regionCity: normalizeString(payload.regionCity),
    regionState: normalizeString(payload.regionState),
    regionKey: normalizeString(payload.regionKey),
    requestedAt: payload.requestedAt || new Date().toISOString(),
    lastJobRunId: normalizeString(payload.lastJobRunId),
    traceId: normalizeString(payload.traceId),
    draftCityPackIds: normalizeArray(payload.draftCityPackIds),
    draftTemplateIds: normalizeArray(payload.draftTemplateIds),
    draftSourceRefIds: normalizeArray(payload.draftSourceRefIds),
    draftSourceCandidates: Array.isArray(payload.draftSourceCandidates) ? payload.draftSourceCandidates.map((item) => String(item)).filter((item) => item.trim()) : [],
    error: typeof payload.error === 'string' ? payload.error : null
  };
}

async function createRequest(data) {
  const payload = normalizePayload(data);
  if (!payload.lineUserId) throw new Error('lineUserId required');
  if (!payload.regionKey) throw new Error('regionKey required');
  if (!payload.traceId) throw new Error('traceId required');
  const db = getDb();
  await db.collection(COLLECTION).doc(payload.id).set({
    status: payload.status,
    lineUserId: payload.lineUserId,
    regionCity: payload.regionCity,
    regionState: payload.regionState,
    regionKey: payload.regionKey,
    requestedAt: payload.requestedAt,
    lastJobRunId: payload.lastJobRunId,
    traceId: payload.traceId,
    draftCityPackIds: payload.draftCityPackIds,
    draftTemplateIds: payload.draftTemplateIds,
    draftSourceRefIds: payload.draftSourceRefIds,
    draftSourceCandidates: payload.draftSourceCandidates,
    error: payload.error,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: false });
  return { id: payload.id };
}

async function getRequest(requestId) {
  if (!requestId) throw new Error('requestId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(requestId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function updateRequest(requestId, patch) {
  if (!requestId) throw new Error('requestId required');
  const payload = patch && typeof patch === 'object' ? Object.assign({}, patch) : {};
  payload.updatedAt = serverTimestamp();
  const db = getDb();
  await db.collection(COLLECTION).doc(requestId).set(payload, { merge: true });
  return { id: requestId };
}

async function listRequests(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(opts.limit)) ? Math.min(Math.max(Math.floor(Number(opts.limit)), 1), 200) : 50;
  let baseQuery = getDb().collection(COLLECTION);
  if (opts.status) baseQuery = baseQuery.where('status', '==', normalizeStatus(opts.status));
  if (opts.regionKey) baseQuery = baseQuery.where('regionKey', '==', String(opts.regionKey));
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
  createRequest,
  getRequest,
  updateRequest,
  listRequests
};
