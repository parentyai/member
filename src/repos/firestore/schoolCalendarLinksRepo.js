'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { VALIDITY_DAYS } = require('./sourceRefsRepo');

const COLLECTION = 'school_calendar_links';
const ALLOWED_STATUS = new Set(['active', 'archived']);

function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeRegionKey(value) {
  const regionKey = normalizeString(value);
  return regionKey ? regionKey.toLowerCase() : null;
}

function normalizeStatus(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_STATUS.has(normalized) ? normalized : 'active';
}

function normalizeSchoolYear(value) {
  const schoolYear = normalizeString(value);
  if (!schoolYear) return null;
  return schoolYear;
}

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

function resolveValidUntil(payload) {
  const validUntil = toDate(payload.validUntil);
  if (validUntil) return validUntil;
  return addDays(new Date(), VALIDITY_DAYS);
}

function resolveId(payload) {
  const explicitId = normalizeString(payload.id);
  if (explicitId) return explicitId;
  return `scl_${crypto.randomUUID()}`;
}

function normalizePayload(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const regionKey = normalizeRegionKey(payload.regionKey);
  const linkRegistryId = normalizeString(payload.linkRegistryId);
  const sourceRefId = normalizeString(payload.sourceRefId);
  const schoolYear = normalizeSchoolYear(payload.schoolYear);
  const traceId = normalizeString(payload.traceId);
  if (!regionKey) throw new Error('regionKey required');
  if (!linkRegistryId) throw new Error('linkRegistryId required');
  if (!sourceRefId) throw new Error('sourceRefId required');
  if (!schoolYear) throw new Error('schoolYear required');
  if (!traceId) throw new Error('traceId required');
  return {
    id: resolveId(payload),
    regionKey,
    linkRegistryId,
    sourceRefId,
    schoolYear,
    status: normalizeStatus(payload.status),
    validUntil: resolveValidUntil(payload),
    traceId
  };
}

async function createSchoolCalendarLink(input) {
  const payload = normalizePayload(input);
  const db = getDb();
  await db.collection(COLLECTION).doc(payload.id).set({
    regionKey: payload.regionKey,
    linkRegistryId: payload.linkRegistryId,
    sourceRefId: payload.sourceRefId,
    schoolYear: payload.schoolYear,
    status: payload.status,
    validUntil: payload.validUntil,
    traceId: payload.traceId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: false });
  return { id: payload.id };
}

async function getSchoolCalendarLink(id) {
  if (!id) throw new Error('id required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function updateSchoolCalendarLink(id, patch) {
  if (!id) throw new Error('id required');
  const payload = patch && typeof patch === 'object' ? Object.assign({}, patch) : {};
  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    payload.status = normalizeStatus(payload.status);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'regionKey')) {
    payload.regionKey = normalizeRegionKey(payload.regionKey);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'schoolYear')) {
    payload.schoolYear = normalizeSchoolYear(payload.schoolYear);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'validUntil')) {
    payload.validUntil = resolveValidUntil(payload);
  }
  payload.updatedAt = serverTimestamp();
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(payload, { merge: true });
  return { id };
}

async function listSchoolCalendarLinks(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(opts.limit)) ? Math.min(Math.max(Math.floor(Number(opts.limit)), 1), 500) : 100;
  const regionKey = normalizeRegionKey(opts.regionKey);
  const status = normalizeString(opts.status) ? normalizeStatus(opts.status) : null;
  const schoolYear = normalizeSchoolYear(opts.schoolYear);
  const queryLimit = (regionKey || status || schoolYear) ? Math.min(limit * 5, 1000) : limit;
  const db = getDb();
  const snap = await db.collection(COLLECTION).orderBy('updatedAt', 'desc').limit(queryLimit).get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  return rows.filter((row) => {
    if (regionKey && String(row.regionKey || '').toLowerCase() !== regionKey) return false;
    if (status && String(row.status || '').toLowerCase() !== status) return false;
    if (schoolYear && String(row.schoolYear || '') !== schoolYear) return false;
    return true;
  }).slice(0, limit);
}

module.exports = {
  COLLECTION,
  ALLOWED_STATUS,
  createSchoolCalendarLink,
  getSchoolCalendarLink,
  updateSchoolCalendarLink,
  listSchoolCalendarLinks
};
