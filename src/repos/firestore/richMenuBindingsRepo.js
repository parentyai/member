'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'rich_menu_bindings';
const IN_QUERY_CHUNK_SIZE = 10;
const ALLOWED_PLAN_TIER = Object.freeze(['free', 'paid']);

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeString(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizePlanTier(value, fallback) {
  const normalized = normalizeString(value, fallback || null);
  if (normalized === null) return null;
  if (!normalized) return fallback || null;
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_PLAN_TIER.includes(lowered)) return null;
  return lowered;
}

function normalizeBinding(lineUserId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    lineUserId: normalizeLineUserId(lineUserId),
    currentMenuKey: normalizeString(payload.currentMenuKey, null),
    currentRichMenuId: normalizeString(payload.currentRichMenuId, null),
    currentTemplateId: normalizeString(payload.currentTemplateId, null),
    previousTemplateId: normalizeString(payload.previousTemplateId, null),
    resolvedRuleId: normalizeString(payload.resolvedRuleId, null),
    planTier: normalizePlanTier(payload.planTier, null),
    phaseId: normalizeString(payload.phaseId, null),
    lastApplyResult: payload.lastApplyResult && typeof payload.lastApplyResult === 'object'
      ? payload.lastApplyResult
      : null,
    lastTraceId: normalizeString(payload.lastTraceId, null),
    nextEligibleAt: payload.nextEligibleAt || null,
    manualOverrideTemplateId: normalizeString(payload.manualOverrideTemplateId, null),
    appliedAt: payload.appliedAt || null,
    lastError: normalizeString(payload.lastError, null),
    updatedAt: payload.updatedAt || null
  };
}

function chunkList(list, size) {
  const out = [];
  const chunkSize = Math.max(1, Number(size) || IN_QUERY_CHUNK_SIZE);
  for (let i = 0; i < list.length; i += chunkSize) {
    out.push(list.slice(i, i + chunkSize));
  }
  return out;
}

async function getRichMenuBinding(lineUserId) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeBinding(id, snap.data());
}

async function upsertRichMenuBinding(lineUserId, patch) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) throw new Error('lineUserId required');
  const payload = patch && typeof patch === 'object' ? patch : {};
  const normalized = normalizeBinding(id, payload);
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    updatedAt: payload.updatedAt || serverTimestamp(),
    appliedAt: payload.appliedAt || normalized.appliedAt || serverTimestamp()
  }), { merge: true });
  return getRichMenuBinding(id);
}

async function listRichMenuBindingsByLineUserIds(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserIds = Array.from(new Set((Array.isArray(payload.lineUserIds) ? payload.lineUserIds : [])
    .map((id) => normalizeLineUserId(id))
    .filter(Boolean)));
  if (!lineUserIds.length) return [];
  const db = getDb();
  const rows = [];
  for (const chunk of chunkList(lineUserIds, IN_QUERY_CHUNK_SIZE)) {
    const docs = await Promise.all(chunk.map(async (lineUserId) => {
      const snap = await db.collection(COLLECTION).doc(lineUserId).get();
      if (!snap.exists) return null;
      return normalizeBinding(lineUserId, snap.data());
    }));
    docs.filter(Boolean).forEach((row) => rows.push(row));
  }
  return rows;
}

module.exports = {
  COLLECTION,
  normalizeBinding,
  getRichMenuBinding,
  upsertRichMenuBinding,
  listRichMenuBindingsByLineUserIds
};
