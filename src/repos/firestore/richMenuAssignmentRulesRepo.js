'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'rich_menu_assignment_rules';
const ALLOWED_STATUS = Object.freeze(['draft', 'active', 'deprecated']);
const ALLOWED_KIND = Object.freeze(['default', 'phase', 'plan', 'combined']);
const ALLOWED_PLAN_TIER = Object.freeze(['free', 'paid']);
const ALLOWED_LOCALE = Object.freeze(['ja', 'en']);

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizeRuleId(value) {
  const normalized = normalizeText(value, '');
  if (!normalized) return '';
  return normalized.replace(/[^a-zA-Z0-9_\-:.]/g, '_').slice(0, 120);
}

function normalizeInteger(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const parsed = Math.floor(num);
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function normalizeStatus(value, fallback) {
  const normalized = normalizeText(value, fallback || 'draft');
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_STATUS.includes(lowered)) return null;
  return lowered;
}

function normalizeKind(value, fallback) {
  const normalized = normalizeText(value, fallback || 'default');
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_KIND.includes(lowered)) return null;
  return lowered;
}

function normalizeTarget(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const planTierRaw = normalizeText(raw.planTier, '');
  const phaseId = normalizeText(raw.phaseId, '') || null;
  const localeRaw = normalizeText(raw.locale, 'ja');

  let planTier = null;
  if (planTierRaw) {
    const lowered = planTierRaw.toLowerCase();
    if (!ALLOWED_PLAN_TIER.includes(lowered)) return null;
    planTier = lowered;
  }

  const locale = localeRaw ? localeRaw.toLowerCase() : 'ja';
  if (!ALLOWED_LOCALE.includes(locale)) return null;

  return {
    planTier,
    phaseId,
    locale
  };
}

function normalizeRichMenuAssignmentRule(input, idHint) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const ruleId = normalizeRuleId(input.ruleId || idHint);
  if (!ruleId) return null;
  const kind = normalizeKind(input.kind, 'default');
  const status = normalizeStatus(input.status, 'draft');
  const templateId = normalizeText(input.templateId, '');
  const priority = normalizeInteger(input.priority, 100, 1, 100000);
  const target = normalizeTarget(input.target);
  if ([kind, status, templateId, priority, target].includes(null) || !templateId) return null;

  return {
    ruleId,
    kind,
    status,
    templateId,
    priority,
    target,
    description: normalizeText(input.description, '') || ''
  };
}

function normalizeRuleDoc(docId, data) {
  const normalized = normalizeRichMenuAssignmentRule(Object.assign({}, data || {}, { ruleId: docId }), docId);
  if (!normalized) return null;
  const payload = data && typeof data === 'object' ? data : {};
  return Object.assign({}, normalized, {
    createdAt: payload.createdAt || null,
    createdBy: normalizeText(payload.createdBy, null),
    updatedAt: payload.updatedAt || null,
    updatedBy: normalizeText(payload.updatedBy, null)
  });
}

async function getRichMenuAssignmentRule(ruleId) {
  const id = normalizeRuleId(ruleId);
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeRuleDoc(id, snap.data());
}

async function upsertRichMenuAssignmentRule(rule, actor) {
  const normalized = normalizeRichMenuAssignmentRule(rule, rule && rule.ruleId);
  if (!normalized) throw new Error('invalid richMenuAssignmentRule');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(normalized.ruleId);
  const existing = await docRef.get();
  const existingData = existing.exists ? (existing.data() || {}) : {};
  const createdAt = existingData.createdAt || serverTimestamp();
  const createdBy = normalizeText(existingData.createdBy, '') || (typeof actor === 'string' && actor.trim() ? actor.trim() : 'unknown');
  const updatedBy = typeof actor === 'string' && actor.trim() ? actor.trim() : 'unknown';
  await docRef.set(Object.assign({}, normalized, {
    createdAt,
    createdBy,
    updatedAt: serverTimestamp(),
    updatedBy
  }), { merge: true });
  return getRichMenuAssignmentRule(normalized.ruleId);
}

async function listRichMenuAssignmentRules(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const statusFilter = normalizeText(payload.status, '') || null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).orderBy('priority', 'desc').get();
  const rows = snap.docs.map((doc) => normalizeRuleDoc(doc.id, doc.data())).filter(Boolean);
  if (!statusFilter) return rows;
  return rows.filter((row) => row.status === statusFilter.toLowerCase());
}

module.exports = {
  COLLECTION,
  normalizeRichMenuAssignmentRule,
  getRichMenuAssignmentRule,
  upsertRichMenuAssignmentRule,
  listRichMenuAssignmentRules
};
