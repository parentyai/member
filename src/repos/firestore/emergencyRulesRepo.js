'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { toMillis } = require('../../usecases/emergency/utils');

const COLLECTION = 'emergency_rules';
const ALLOWED_SEVERITY = new Set(['ANY', 'INFO', 'INFO+', 'WARN', 'WARN+', 'CRITICAL', 'CRITICAL+']);
const ALLOWED_PRIORITY = new Set(['emergency', 'standard']);

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeProviderKey(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeEventType(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeSeverity(value, fallback) {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (ALLOWED_SEVERITY.has(raw)) return raw;
  return fallback && ALLOWED_SEVERITY.has(fallback) ? fallback : 'ANY';
}

function normalizePriority(value, fallback) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (ALLOWED_PRIORITY.has(raw)) return raw;
  return fallback && ALLOWED_PRIORITY.has(fallback) ? fallback : 'emergency';
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback === true;
}

function normalizeMaxRecipients(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Number.isFinite(Number(fallback)) && Number(fallback) > 0 ? Math.floor(Number(fallback)) : 500;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), 10000);
}

function normalizeRegion(value, fallbackRegionKey) {
  const fallback = normalizeString(fallbackRegionKey);
  if (!value || (typeof value !== 'object' && typeof value !== 'string')) {
    return fallback ? { regionKey: fallback } : null;
  }
  if (typeof value === 'string') {
    const regionKey = normalizeString(value);
    return regionKey ? { regionKey } : (fallback ? { regionKey: fallback } : null);
  }
  const payload = value;
  const region = {
    regionKey: normalizeString(payload.regionKey) || fallback || null,
    state: normalizeString(payload.state),
    city: normalizeString(payload.city),
    county: normalizeString(payload.county),
    zip: normalizeString(payload.zip)
  };
  if (!region.regionKey && !region.state && !region.city && !region.county && !region.zip) return null;
  return region;
}

function resolveRuleId(ruleId, payload) {
  const direct = normalizeString(ruleId);
  if (direct) return direct;
  const fromPayload = normalizeString(payload && payload.ruleId);
  if (fromPayload) return fromPayload;
  return `emr_${crypto.randomUUID()}`;
}

function normalizeRule(ruleId, data, existing) {
  const payload = data && typeof data === 'object' ? data : {};
  const current = existing && typeof existing === 'object' ? existing : {};
  const id = resolveRuleId(ruleId, payload);
  return {
    id,
    ruleId: id,
    providerKey: normalizeProviderKey(payload.providerKey) || normalizeProviderKey(current.providerKey),
    eventType: normalizeEventType(payload.eventType) || normalizeEventType(current.eventType),
    severity: normalizeSeverity(payload.severity, normalizeSeverity(current.severity, 'ANY')),
    region: normalizeRegion(payload.region, current && current.region && current.region.regionKey),
    membersOnly: normalizeBoolean(payload.membersOnly, current.membersOnly === true),
    role: normalizeString(payload.role) || normalizeString(current.role),
    autoSend: normalizeBoolean(payload.autoSend, current.autoSend === true),
    enabled: normalizeBoolean(payload.enabled, current.enabled === true),
    priority: normalizePriority(payload.priority, current.priority || 'emergency'),
    maxRecipients: normalizeMaxRecipients(payload.maxRecipients, current.maxRecipients || 500),
    displayLabel: normalizeString(payload.displayLabel) || normalizeString(current.displayLabel),
    policySummary: normalizeString(payload.policySummary) || normalizeString(current.policySummary),
    operatorAction: normalizeString(payload.operatorAction) || normalizeString(current.operatorAction),
    traceId: normalizeString(payload.traceId) || normalizeString(current.traceId),
    createdBy: normalizeString(current.createdBy) || normalizeString(payload.createdBy),
    updatedBy: normalizeString(payload.updatedBy) || normalizeString(current.updatedBy)
  };
}

function sortByUpdatedAtDesc(rows) {
  return (rows || []).slice().sort((left, right) => {
    return toMillis(right && right.updatedAt) - toMillis(left && left.updatedAt);
  });
}

async function getRule(ruleId) {
  const id = normalizeString(ruleId);
  if (!id) throw new Error('ruleId required');
  const snap = await getDb().collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id, ruleId: snap.id }, snap.data());
}

async function upsertRule(ruleId, patch, actor) {
  const id = resolveRuleId(ruleId, patch);
  const existing = await getRule(id).catch(() => null);
  const normalized = normalizeRule(id, patch, existing);
  await getDb().collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    createdAt: existing && existing.createdAt ? existing.createdAt : serverTimestamp(),
    createdBy: existing && existing.createdBy
      ? existing.createdBy
      : (normalizeString(actor) || normalizeString(normalized.createdBy) || null),
    updatedAt: serverTimestamp(),
    updatedBy: normalizeString(actor) || normalizeString(normalized.updatedBy) || null
  }), { merge: true });
  return getRule(id);
}

async function listRules(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(payload.limit))
    ? Math.min(Math.max(Math.floor(Number(payload.limit)), 1), 500)
    : 100;
  const enabledFilter = payload.enabled === true || payload.enabled === false ? payload.enabled : null;
  const providerKeyFilter = normalizeProviderKey(payload.providerKey);

  let query = getDb().collection(COLLECTION);
  if (enabledFilter !== null) query = query.where('enabled', '==', enabledFilter);
  else if (providerKeyFilter) query = query.where('providerKey', '==', providerKeyFilter);

  const snap = await query.limit(limit).get();
  let rows = snap.docs.map((doc) => Object.assign({ id: doc.id, ruleId: doc.id }, doc.data()));
  if (providerKeyFilter) {
    rows = rows.filter((row) => normalizeProviderKey(row && row.providerKey) === providerKeyFilter);
  }
  if (enabledFilter !== null) {
    rows = rows.filter((row) => Boolean(row && row.enabled) === enabledFilter);
  }
  return sortByUpdatedAtDesc(rows).slice(0, limit);
}

async function listEnabledRulesNow(params) {
  const payload = params && typeof params === 'object' ? params : {};
  return listRules(Object.assign({}, payload, { enabled: true }));
}

module.exports = {
  COLLECTION,
  normalizeRule,
  normalizeProviderKey,
  normalizeEventType,
  normalizeSeverity,
  normalizePriority,
  getRule,
  upsertRule,
  listRules,
  listEnabledRulesNow
};
