'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'link_registry';
const ALLOWED_DOMAIN_CLASS = new Set(['gov', 'k12_district', 'school_public', 'unknown']);
const ALLOWED_SCHOOL_TYPE = new Set(['public', 'private', 'unknown']);
const ALLOWED_EDU_SCOPE = new Set(['calendar', 'district_info', 'enrollment', 'closure_alert']);

function hasOwn(obj, key) {
  return Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

function resolveTimestamp(at) {
  return at || serverTimestamp();
}

function normalizeEnum(value, allowed, fallback) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return fallback;
  return allowed.has(normalized) ? normalized : fallback;
}

function normalizeNullableEnum(value, allowed) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return null;
  return allowed.has(normalized) ? normalized : null;
}

function normalizeRegionKey(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizeTags(values) {
  if (!Array.isArray(values)) return [];
  const tags = values
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter((value) => value.length > 0);
  return Array.from(new Set(tags));
}

function normalizeEducationFields(payload, options) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const opts = options && typeof options === 'object' ? options : {};
  const partial = opts.partial === true;
  const out = {};

  if (!partial || hasOwn(data, 'domainClass')) {
    out.domainClass = normalizeEnum(data.domainClass, ALLOWED_DOMAIN_CLASS, 'unknown');
  }
  if (!partial || hasOwn(data, 'schoolType')) {
    out.schoolType = normalizeEnum(data.schoolType, ALLOWED_SCHOOL_TYPE, 'unknown');
  }
  if (!partial || hasOwn(data, 'eduScope')) {
    out.eduScope = normalizeNullableEnum(data.eduScope, ALLOWED_EDU_SCOPE);
  }
  if (!partial || hasOwn(data, 'regionKey')) {
    out.regionKey = normalizeRegionKey(data.regionKey);
  }
  if (!partial || hasOwn(data, 'tags')) {
    out.tags = normalizeTags(data.tags);
  }
  return out;
}

function normalizeEducationFilter(value, allowed) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return allowed.has(normalized) ? normalized : null;
}

function normalizeNullableFilter(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function matchesEducationFilters(row, filters) {
  const item = row && typeof row === 'object' ? row : {};
  const opts = filters && typeof filters === 'object' ? filters : {};
  if (opts.domainClass && String(item.domainClass || 'unknown') !== opts.domainClass) return false;
  if (opts.schoolType && String(item.schoolType || 'unknown') !== opts.schoolType) return false;
  if (opts.eduScope) {
    const scope = item.eduScope ? String(item.eduScope) : null;
    if (scope !== opts.eduScope) return false;
  }
  if (opts.regionKey) {
    const regionKey = item.regionKey ? String(item.regionKey).toLowerCase() : null;
    if (regionKey !== opts.regionKey) return false;
  }
  if (Array.isArray(opts.tags) && opts.tags.length) {
    const current = normalizeTags(item.tags);
    if (!opts.tags.every((tag) => current.includes(tag))) return false;
  }
  return true;
}

async function createLink(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const payload = Object.assign(
    {},
    data || {},
    normalizeEducationFields(data),
    { createdAt: resolveTimestamp(data && data.createdAt) }
  );
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

async function updateLink(id, patch) {
  if (!id) throw new Error('link id required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const payload = Object.assign({}, patch || {}, normalizeEducationFields(patch, { partial: true }));
  await docRef.set(payload, { merge: true });
  return { id };
}

async function getLink(id) {
  if (!id) throw new Error('link id required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listLinks(params) {
  const db = getDb();
  const opts = params || {};
  const domainClass = normalizeEducationFilter(opts.domainClass, ALLOWED_DOMAIN_CLASS);
  const schoolType = normalizeEducationFilter(opts.schoolType, ALLOWED_SCHOOL_TYPE);
  const eduScope = normalizeNullableFilter(opts.eduScope);
  const regionKey = normalizeNullableFilter(opts.regionKey);
  const tags = normalizeTags(opts.tags);
  let baseQuery = db.collection(COLLECTION);
  if (opts.state) baseQuery = baseQuery.where('lastHealth.state', '==', opts.state);
  let query = baseQuery.orderBy('createdAt', 'desc');
  const limit = typeof opts.limit === 'number' ? opts.limit : 50;
  const hasEducationFilters = Boolean(domainClass || schoolType || eduScope || regionKey || tags.length);
  const queryLimit = hasEducationFilters ? Math.min(limit * 5, 1000) : limit;
  if (queryLimit) query = query.limit(queryLimit);
  const snap = await query.get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  const filtered = hasEducationFilters
    ? rows.filter((item) => matchesEducationFilters(item, {
      domainClass,
      schoolType,
      eduScope,
      regionKey,
      tags
    }))
    : rows;
  return filtered.slice(0, limit);
}

async function setHealth(id, health) {
  if (!id) throw new Error('link id required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const payload = { lastHealth: Object.assign({}, health, { checkedAt: resolveTimestamp(health && health.checkedAt) }) };
  await docRef.set(payload, { merge: true });
  return { id };
}

async function deleteLink(id) {
  if (!id) throw new Error('link id required');
  const db = getDb();
  await db.collection(COLLECTION).doc(id).delete();
  return { id };
}

module.exports = {
  ALLOWED_DOMAIN_CLASS,
  ALLOWED_SCHOOL_TYPE,
  ALLOWED_EDU_SCOPE,
  normalizeEducationFields,
  createLink,
  getLink,
  updateLink,
  listLinks,
  setHealth,
  deleteLink
};
