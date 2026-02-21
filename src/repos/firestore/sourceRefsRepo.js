'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { isMissingIndexError, sortByTimestampDesc, toMillis } = require('./queryFallback');
const { recordMissingIndexFallback, shouldFailOnMissingIndex } = require('./indexFallbackPolicy');

const COLLECTION = 'source_refs';
const VALIDITY_DAYS = 120;
const ALLOWED_STATUS = new Set(['active', 'needs_review', 'dead', 'blocked', 'retired']);
const ALLOWED_RISK_LEVEL = new Set(['low', 'medium', 'high']);
const ALLOWED_SOURCE_TYPE = new Set(['official', 'semi_official', 'community', 'other']);
const ALLOWED_REQUIRED_LEVEL = new Set(['required', 'optional']);
const ALLOWED_AUDIT_STAGE = new Set(['light', 'heavy']);

function normalizeStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_STATUS.has(status) ? status : 'needs_review';
}

function normalizeRiskLevel(value) {
  const risk = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_RISK_LEVEL.has(risk) ? risk : 'medium';
}

function normalizeSourceType(value) {
  const sourceType = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_SOURCE_TYPE.has(sourceType) ? sourceType : 'other';
}

function normalizeRequiredLevel(value) {
  const requiredLevel = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_REQUIRED_LEVEL.has(requiredLevel) ? requiredLevel : 'required';
}

function normalizeAuditStage(value) {
  const stage = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_AUDIT_STAGE.has(stage) ? stage : null;
}

function normalizeConfidenceScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(0, Math.round(num)));
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

function resolveValidFrom(data) {
  const now = new Date();
  const validFrom = toDate(data && data.validFrom);
  return validFrom || now;
}

function resolveValidUntil(data) {
  const validUntil = toDate(data && data.validUntil);
  if (validUntil) return validUntil;
  const validFrom = resolveValidFrom(data);
  return addDays(validFrom, VALIDITY_DAYS);
}

function normalizeArray(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim())));
}

function normalizeSourceRefData(data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    url: typeof payload.url === 'string' ? payload.url.trim() : '',
    status: normalizeStatus(payload.status),
    validFrom: resolveValidFrom(payload),
    validUntil: resolveValidUntil(payload),
    lastResult: typeof payload.lastResult === 'string' ? payload.lastResult.trim() : null,
    lastCheckAt: toDate(payload.lastCheckAt),
    contentHash: typeof payload.contentHash === 'string' ? payload.contentHash.trim() : null,
    riskLevel: normalizeRiskLevel(payload.riskLevel),
    sourceType: normalizeSourceType(payload.sourceType),
    requiredLevel: normalizeRequiredLevel(payload.requiredLevel),
    confidenceScore: normalizeConfidenceScore(payload.confidenceScore),
    lastAuditStage: normalizeAuditStage(payload.lastAuditStage),
    evidenceLatestId: typeof payload.evidenceLatestId === 'string' ? payload.evidenceLatestId.trim() : null,
    usedByCityPackIds: normalizeArray(payload.usedByCityPackIds)
  };
}

function normalizeSourcePolicyPatch(data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    sourceType: normalizeSourceType(payload.sourceType),
    requiredLevel: normalizeRequiredLevel(payload.requiredLevel)
  };
}

function ensureUrl(url) {
  if (!url) throw new Error('url required');
  try {
    const parsed = new URL(url);
    if (!parsed.protocol || !parsed.host) throw new Error('url invalid');
  } catch (_err) {
    throw new Error('url invalid');
  }
}

function resolveId(data) {
  const payload = data && typeof data === 'object' ? data : {};
  if (typeof payload.id === 'string' && payload.id.trim()) return payload.id.trim();
  return `sr_${crypto.randomUUID()}`;
}

async function createSourceRef(data) {
  const normalized = normalizeSourceRefData(data);
  ensureUrl(normalized.url);
  const id = resolveId(data);
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set({
    url: normalized.url,
    status: normalized.status,
    validFrom: normalized.validFrom,
    validUntil: normalized.validUntil,
    lastResult: normalized.lastResult,
    lastCheckAt: normalized.lastCheckAt,
    contentHash: normalized.contentHash,
    riskLevel: normalized.riskLevel,
    sourceType: normalized.sourceType,
    requiredLevel: normalized.requiredLevel,
    confidenceScore: normalized.confidenceScore,
    lastAuditStage: normalized.lastAuditStage,
    evidenceLatestId: normalized.evidenceLatestId,
    usedByCityPackIds: normalized.usedByCityPackIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: false });
  return { id };
}

async function getSourceRef(sourceRefId) {
  if (!sourceRefId) throw new Error('sourceRefId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(sourceRefId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listSourceRefs(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const db = getDb();
  const limit = Number.isFinite(Number(opts.limit)) ? Math.min(Math.max(Math.floor(Number(opts.limit)), 1), 1000) : 100;
  const expiringBeforeMs = opts.expiringBefore ? toMillis(opts.expiringBefore) : null;
  let baseQuery = db.collection(COLLECTION);
  if (opts.status) {
    const status = normalizeStatus(opts.status);
    baseQuery = baseQuery.where('status', '==', status);
  }

  let rows;
  try {
    const snap = await baseQuery.orderBy('updatedAt', 'desc').limit(limit).get();
    rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    recordMissingIndexFallback({
      repo: 'sourceRefsRepo',
      query: 'listSourceRefs',
      err
    });
    if (shouldFailOnMissingIndex()) throw err;
    const snap = await baseQuery.get();
    rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    sortByTimestampDesc(rows, 'updatedAt');
    rows = rows.slice(0, limit);
  }

  if (!expiringBeforeMs) return rows;
  return rows.filter((row) => {
    const validUntilMs = toMillis(row && row.validUntil);
    return validUntilMs > 0 && validUntilMs <= expiringBeforeMs;
  });
}

async function listSourceRefsForAudit(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const now = toDate(opts.now) || new Date();
  const horizonDays = Number.isFinite(Number(opts.horizonDays)) ? Math.max(Math.floor(Number(opts.horizonDays)), 0) : 14;
  const horizonMs = addDays(now, horizonDays).getTime();
  const all = await listSourceRefs({ limit: Number.isFinite(Number(opts.limit)) ? Number(opts.limit) : 300 });
  return all.filter((row) => {
    const status = normalizeStatus(row && row.status);
    if (status === 'needs_review') return true;
    if (status === 'active') {
      const validUntilMs = toMillis(row && row.validUntil);
      return validUntilMs > 0 && validUntilMs <= horizonMs;
    }
    return false;
  }).sort((a, b) => toMillis(a && a.validUntil) - toMillis(b && b.validUntil));
}

async function updateSourceRef(sourceRefId, patch) {
  if (!sourceRefId) throw new Error('sourceRefId required');
  const payload = patch && typeof patch === 'object' ? Object.assign({}, patch) : {};
  payload.updatedAt = serverTimestamp();
  const db = getDb();
  await db.collection(COLLECTION).doc(sourceRefId).set(payload, { merge: true });
  return { id: sourceRefId };
}

async function linkCityPack(sourceRefId, cityPackId) {
  if (!sourceRefId) throw new Error('sourceRefId required');
  if (!cityPackId) throw new Error('cityPackId required');
  const current = await getSourceRef(sourceRefId);
  if (!current) throw new Error('sourceRef not found');
  const next = normalizeArray([].concat(current.usedByCityPackIds || [], [cityPackId]));
  await updateSourceRef(sourceRefId, { usedByCityPackIds: next });
  return { id: sourceRefId, usedByCityPackIds: next };
}

module.exports = {
  VALIDITY_DAYS,
  normalizeAuditStage,
  normalizeConfidenceScore,
  normalizeRequiredLevel,
  normalizeSourcePolicyPatch,
  createSourceRef,
  getSourceRef,
  listSourceRefs,
  listSourceRefsForAudit,
  updateSourceRef,
  linkCityPack
};
