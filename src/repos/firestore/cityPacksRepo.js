'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { isMissingIndexError, sortByTimestampDesc, toMillis } = require('./queryFallback');

const COLLECTION = 'city_packs';
const VALIDITY_DAYS = 120;
const ALLOWED_STATUS = new Set(['draft', 'active', 'retired']);

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(baseDate, days) {
  const next = new Date(baseDate.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_STATUS.has(status) ? status : 'draft';
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())));
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRules(values) {
  if (!Array.isArray(values)) return [];
  return values.filter((value) => value && typeof value === 'object').map((value) => Object.assign({}, value));
}

function normalizeAllowedIntents(value) {
  const list = normalizeStringArray(Array.isArray(value) ? value : ['CITY_PACK']);
  return list.length ? list : ['CITY_PACK'];
}

function resolveValidUntil(payload) {
  const validUntil = toDate(payload.validUntil);
  if (validUntil) return validUntil;
  const validFrom = toDate(payload.validFrom) || new Date();
  return addDays(validFrom, VALIDITY_DAYS);
}

function normalizePayload(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  return {
    id: typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : `cp_${crypto.randomUUID()}`,
    name,
    status: normalizeStatus(payload.status),
    sourceRefs: normalizeStringArray(payload.sourceRefs),
    templateRefs: normalizeStringArray(payload.templateRefs),
    validUntil: resolveValidUntil(payload),
    allowedIntents: normalizeAllowedIntents(payload.allowedIntents),
    rules: normalizeRules(payload.rules),
    description: typeof payload.description === 'string' ? payload.description.trim() : '',
    metadata: payload.metadata && typeof payload.metadata === 'object' ? Object.assign({}, payload.metadata) : {},
    requestId: normalizeString(payload.requestId)
  };
}

async function createCityPack(data) {
  const payload = normalizePayload(data);
  if (!payload.name) throw new Error('name required');
  if (!payload.sourceRefs.length) throw new Error('sourceRefs required');
  const db = getDb();
  await db.collection(COLLECTION).doc(payload.id).set({
    name: payload.name,
    status: payload.status,
    sourceRefs: payload.sourceRefs,
    templateRefs: payload.templateRefs,
    validUntil: payload.validUntil,
    allowedIntents: payload.allowedIntents,
    rules: payload.rules,
    description: payload.description,
    metadata: payload.metadata,
    requestId: payload.requestId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: false });
  return { id: payload.id };
}

async function getCityPack(cityPackId) {
  if (!cityPackId) throw new Error('cityPackId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(cityPackId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listCityPacks(params) {
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
  if (!opts.activeOnly) return rows;
  const now = Date.now();
  return rows.filter((row) => row.status === 'active' && toMillis(row.validUntil) > now);
}

async function updateCityPack(cityPackId, patch) {
  if (!cityPackId) throw new Error('cityPackId required');
  const payload = patch && typeof patch === 'object' ? Object.assign({}, patch) : {};
  payload.updatedAt = serverTimestamp();
  const db = getDb();
  await db.collection(COLLECTION).doc(cityPackId).set(payload, { merge: true });
  return { id: cityPackId };
}

module.exports = {
  VALIDITY_DAYS,
  createCityPack,
  getCityPack,
  listCityPacks,
  updateCityPack
};
