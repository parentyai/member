'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { isMissingIndexError, sortByTimestampDesc, toMillis } = require('./queryFallback');

const COLLECTION = 'city_pack_feedback';
const ALLOWED_STATUS = new Set(['queued', 'reviewed', 'rejected', 'proposed']);

function normalizeStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_STATUS.has(status) ? status : 'queued';
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveId(payload) {
  if (payload && typeof payload.id === 'string' && payload.id.trim()) return payload.id.trim();
  return `cpf_${crypto.randomUUID()}`;
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
    feedbackText: normalizeString(payload.feedbackText),
    traceId: normalizeString(payload.traceId),
    requestId: normalizeString(payload.requestId)
  };
}

async function createFeedback(data) {
  const payload = normalizePayload(data);
  if (!payload.lineUserId) throw new Error('lineUserId required');
  if (!payload.feedbackText) throw new Error('feedbackText required');
  if (!payload.traceId) throw new Error('traceId required');
  const db = getDb();
  await db.collection(COLLECTION).doc(payload.id).set({
    status: payload.status,
    lineUserId: payload.lineUserId,
    regionCity: payload.regionCity,
    regionState: payload.regionState,
    regionKey: payload.regionKey,
    feedbackText: payload.feedbackText,
    traceId: payload.traceId,
    requestId: payload.requestId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: false });
  return { id: payload.id };
}

async function getFeedback(feedbackId) {
  if (!feedbackId) throw new Error('feedbackId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(feedbackId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function updateFeedback(feedbackId, patch) {
  if (!feedbackId) throw new Error('feedbackId required');
  const payload = patch && typeof patch === 'object' ? Object.assign({}, patch) : {};
  payload.updatedAt = serverTimestamp();
  const db = getDb();
  await db.collection(COLLECTION).doc(feedbackId).set(payload, { merge: true });
  return { id: feedbackId };
}

async function listFeedback(params) {
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
  createFeedback,
  getFeedback,
  updateFeedback,
  listFeedback
};
