'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'municipality_schools';
const ALLOWED_TYPE = 'public';

function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeRegionKey(value) {
  const regionKey = normalizeString(value);
  return regionKey ? regionKey.toLowerCase() : null;
}

function normalizeType(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized === ALLOWED_TYPE ? ALLOWED_TYPE : ALLOWED_TYPE;
}

function normalizeIdPart(value, fallback) {
  return String(value || fallback || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;
}

function buildSchoolId(payload) {
  const regionKey = normalizeIdPart(payload.regionKey, 'unknown');
  const name = normalizeIdPart(payload.name, 'school');
  const district = normalizeIdPart(payload.district, 'district');
  return `ms_${regionKey}_${district}_${name}`;
}

function resolveSchoolId(payload) {
  const explicitId = normalizeString(payload && payload.id);
  if (explicitId) return explicitId;
  return buildSchoolId(payload || {});
}

function normalizeSchoolPayload(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const regionKey = normalizeRegionKey(payload.regionKey);
  const name = normalizeString(payload.name);
  const district = normalizeString(payload.district);
  const sourceLinkRegistryId = normalizeString(payload.sourceLinkRegistryId);
  const sourceUrl = normalizeString(payload.sourceUrl);
  const traceId = normalizeString(payload.traceId);
  const lastFetchedAt = payload.lastFetchedAt || new Date().toISOString();

  if (!regionKey) throw new Error('regionKey required');
  if (!name) throw new Error('name required');
  if (!district) throw new Error('district required');
  if (!sourceLinkRegistryId) throw new Error('sourceLinkRegistryId required');
  if (!sourceUrl) throw new Error('sourceUrl required');
  if (!traceId) throw new Error('traceId required');

  return {
    id: resolveSchoolId(payload),
    regionKey,
    name,
    type: normalizeType(payload.type),
    district,
    sourceLinkRegistryId,
    sourceUrl,
    lastFetchedAt,
    traceId
  };
}

async function getSchool(id) {
  if (!id) throw new Error('school id required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function upsertSchool(input) {
  const payload = normalizeSchoolPayload(input);
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(payload.id);
  const existing = await docRef.get();
  const row = {
    regionKey: payload.regionKey,
    name: payload.name,
    type: payload.type,
    district: payload.district,
    sourceLinkRegistryId: payload.sourceLinkRegistryId,
    sourceUrl: payload.sourceUrl,
    lastFetchedAt: payload.lastFetchedAt,
    traceId: payload.traceId,
    updatedAt: serverTimestamp()
  };
  if (!existing.exists) row.createdAt = serverTimestamp();
  await docRef.set(row, { merge: true });
  return { id: payload.id };
}

async function listSchools(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(opts.limit)) ? Math.min(Math.max(Math.floor(Number(opts.limit)), 1), 500) : 100;
  const regionKey = normalizeRegionKey(opts.regionKey);
  const district = normalizeString(opts.district);
  const type = normalizeType(opts.type);
  const db = getDb();
  let query = db.collection(COLLECTION).orderBy('updatedAt', 'desc');
  const hasFilters = Boolean(regionKey || district || type);
  const queryLimit = hasFilters ? Math.min(limit * 5, 1000) : limit;
  query = query.limit(queryLimit);
  const snap = await query.get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  return rows.filter((row) => {
    if (regionKey && String(row.regionKey || '').toLowerCase() !== regionKey) return false;
    if (district && String(row.district || '') !== district) return false;
    if (type && String(row.type || ALLOWED_TYPE).toLowerCase() !== type) return false;
    return true;
  }).slice(0, limit);
}

module.exports = {
  COLLECTION,
  ALLOWED_TYPE,
  buildSchoolId,
  normalizeSchoolPayload,
  getSchool,
  upsertSchool,
  listSchools
};
