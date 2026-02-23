'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'city_pack_feedback';
const ALLOWED_STATUS = new Set([
  'queued',
  'reviewed',
  'rejected',
  'proposed',
  'new',
  'triaged',
  'resolved'
]);
const ALLOWED_PACK_CLASS = new Set(['regional', 'nationwide']);
const DEFAULT_PACK_CLASS = 'regional';
const DEFAULT_LANGUAGE = 'ja';

function normalizeStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_STATUS.has(status) ? status : 'queued';
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizePackClass(value) {
  const packClass = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_PACK_CLASS.has(packClass) ? packClass : DEFAULT_PACK_CLASS;
}

function normalizeLanguage(value) {
  const language = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return language || DEFAULT_LANGUAGE;
}

function normalizePackClassFilter(value) {
  if (typeof value !== 'string') return null;
  const packClass = value.trim().toLowerCase();
  if (!packClass) return null;
  return ALLOWED_PACK_CLASS.has(packClass) ? packClass : null;
}

function normalizeLanguageFilter(value) {
  if (typeof value !== 'string') return null;
  const language = value.trim().toLowerCase();
  return language || null;
}

function resolveId(payload) {
  if (payload && typeof payload.id === 'string' && payload.id.trim()) return payload.id.trim();
  return `cpf_${crypto.randomUUID()}`;
}

function normalizePayload(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const feedbackText = normalizeString(payload.feedbackText);
  const message = normalizeString(payload.message);
  const slotKey = normalizeString(payload.slotKey);
  const resolution = normalizeString(payload.resolution);
  return {
    id: resolveId(payload),
    status: normalizeStatus(payload.status),
    lineUserId: normalizeString(payload.lineUserId),
    regionCity: normalizeString(payload.regionCity),
    regionState: normalizeString(payload.regionState),
    regionKey: normalizeString(payload.regionKey),
    packClass: normalizePackClass(payload.packClass),
    language: normalizeLanguage(payload.language),
    slotKey,
    feedbackText: feedbackText || message,
    message: message || feedbackText,
    resolution,
    resolvedAt: payload.resolvedAt || null,
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
    packClass: payload.packClass,
    language: payload.language,
    slotKey: payload.slotKey,
    feedbackText: payload.feedbackText,
    message: payload.message,
    resolution: payload.resolution,
    resolvedAt: payload.resolvedAt,
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
  const packClass = normalizePackClassFilter(opts.packClass);
  if (packClass) baseQuery = baseQuery.where('packClass', '==', packClass);
  const language = normalizeLanguageFilter(opts.language);
  if (language) baseQuery = baseQuery.where('language', '==', language);
  const snap = await baseQuery.orderBy('updatedAt', 'desc').limit(limit).get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  return rows;
}

module.exports = {
  normalizeStatus,
  normalizePackClass,
  normalizeLanguage,
  createFeedback,
  getFeedback,
  updateFeedback,
  listFeedback
};
