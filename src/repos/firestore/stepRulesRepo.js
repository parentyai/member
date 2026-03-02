'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { LEAD_TIME_KIND, LEAD_TIME_KIND_VALUES } = require('../../domain/tasks/constants');

const COLLECTION = 'step_rules';
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const ALLOWED_RISK_LEVEL = Object.freeze(['low', 'medium', 'high']);

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeBoolean(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function normalizeNumber(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.floor(parsed);
  if (Number.isFinite(min) && clamped < min) return fallback;
  if (Number.isFinite(max) && clamped > max) return fallback;
  return clamped;
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1000000000000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  value.forEach((item) => {
    const normalized = normalizeText(item, '');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function normalizeQuietHours(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const startHourUtc = normalizeNumber(value.startHourUtc, null, 0, 23);
  const endHourUtc = normalizeNumber(value.endHourUtc, null, 0, 23);
  if (!Number.isInteger(startHourUtc) || !Number.isInteger(endHourUtc)) return null;
  return { startHourUtc, endHourUtc };
}

function normalizeLeadTime(value) {
  const payload = value && typeof value === 'object' ? value : {};
  const kind = normalizeText(payload.kind, LEAD_TIME_KIND.AFTER).toLowerCase();
  if (!LEAD_TIME_KIND_VALUES.includes(kind)) return null;
  const days = normalizeNumber(payload.days, 0, 0, 3650);
  if (!Number.isInteger(days)) return null;
  return { kind, days };
}

function normalizeTrigger(value) {
  const payload = value && typeof value === 'object' ? value : {};
  const eventKey = normalizeText(payload.eventKey, null);
  const source = normalizeText(payload.source, null);
  return {
    eventKey,
    source
  };
}

function normalizeConstraints(value) {
  const payload = value && typeof value === 'object' ? value : {};
  const quietHours = normalizeQuietHours(payload.quietHours);
  const maxActions = normalizeNumber(payload.maxActions, null, 0, 50);
  const planLimit = normalizeNumber(payload.planLimit, null, 0, 1000);
  return {
    quietHours,
    maxActions: Number.isInteger(maxActions) ? maxActions : null,
    planLimit: Number.isInteger(planLimit) ? planLimit : null
  };
}

function normalizeRiskLevel(value, fallback) {
  const normalized = normalizeText(value, fallback || 'medium').toLowerCase();
  if (!ALLOWED_RISK_LEVEL.includes(normalized)) return fallback || 'medium';
  return normalized;
}

function normalizeStepRule(ruleId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  const id = normalizeText(ruleId || payload.ruleId, '');
  if (!id) return null;
  const trigger = normalizeTrigger(payload.trigger);
  const leadTime = normalizeLeadTime(payload.leadTime);
  if (!leadTime) return null;
  return {
    id,
    ruleId: id,
    scenarioKey: normalizeText(payload.scenarioKey, null),
    stepKey: normalizeText(payload.stepKey, null),
    trigger,
    leadTime,
    dependsOn: normalizeStringList(payload.dependsOn),
    constraints: normalizeConstraints(payload.constraints),
    priority: normalizeNumber(payload.priority, 100, 0, 100000),
    enabled: normalizeBoolean(payload.enabled, false) === true,
    validFrom: toIso(payload.validFrom),
    validUntil: toIso(payload.validUntil),
    riskLevel: normalizeRiskLevel(payload.riskLevel, 'medium'),
    nudgeTemplate: payload.nudgeTemplate && typeof payload.nudgeTemplate === 'object'
      ? {
        title: normalizeText(payload.nudgeTemplate.title, null),
        body: normalizeText(payload.nudgeTemplate.body, null),
        ctaText: normalizeText(payload.nudgeTemplate.ctaText, null),
        linkRegistryId: normalizeText(payload.nudgeTemplate.linkRegistryId, null),
        notificationCategory: normalizeText(payload.nudgeTemplate.notificationCategory, null)
      }
      : null,
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null,
    createdBy: normalizeText(payload.createdBy, null),
    updatedBy: normalizeText(payload.updatedBy, null)
  };
}

function resolveLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function isRuleActiveAt(rule, nowIso) {
  const row = rule && typeof rule === 'object' ? rule : {};
  const nowMs = Date.parse(nowIso || new Date().toISOString());
  if (!row.enabled) return false;
  if (row.validFrom) {
    const fromMs = Date.parse(row.validFrom);
    if (Number.isFinite(fromMs) && fromMs > nowMs) return false;
  }
  if (row.validUntil) {
    const untilMs = Date.parse(row.validUntil);
    if (Number.isFinite(untilMs) && untilMs < nowMs) return false;
  }
  return true;
}

async function getStepRule(ruleId) {
  const id = normalizeText(ruleId, '');
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeStepRule(id, snap.data());
}

async function upsertStepRule(ruleId, patch, actor) {
  const id = normalizeText(ruleId, '');
  if (!id) throw new Error('ruleId required');
  const existing = await getStepRule(id);
  const normalized = normalizeStepRule(id, Object.assign({}, existing || {}, patch || {}, { ruleId: id }));
  if (!normalized) throw new Error('invalid step rule');
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    updatedAt: serverTimestamp(),
    updatedBy: normalizeText(actor, normalized.updatedBy),
    createdAt: normalized.createdAt || serverTimestamp(),
    createdBy: normalized.createdBy || normalizeText(actor, null)
  }), { merge: true });
  return getStepRule(id);
}

async function listStepRules(filters) {
  const payload = filters && typeof filters === 'object' ? filters : {};
  const db = getDb();
  let query = db.collection(COLLECTION);
  if (payload.enabled === true || payload.enabled === false) {
    query = query.where('enabled', '==', payload.enabled);
  }
  if (payload.scenarioKey) query = query.where('scenarioKey', '==', normalizeText(payload.scenarioKey, null));
  if (payload.stepKey) query = query.where('stepKey', '==', normalizeText(payload.stepKey, null));
  const limit = resolveLimit(payload.limit);
  const snap = await query.orderBy('priority', 'desc').limit(limit).get();
  return snap.docs
    .map((doc) => normalizeStepRule(doc.id, doc.data()))
    .filter(Boolean);
}

async function listEnabledStepRulesNow(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const now = payload.now || new Date().toISOString();
  const list = await listStepRules(Object.assign({}, payload, { enabled: true }));
  return list.filter((item) => isRuleActiveAt(item, now));
}

module.exports = {
  COLLECTION,
  ALLOWED_RISK_LEVEL,
  normalizeStepRule,
  isRuleActiveAt,
  getStepRule,
  upsertStepRule,
  listStepRules,
  listEnabledStepRulesNow
};
