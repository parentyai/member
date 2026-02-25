'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'rich_menu_templates';
const ALLOWED_KIND = Object.freeze(['default', 'phase', 'plan', 'combined']);
const ALLOWED_STATUS = Object.freeze(['draft', 'active', 'deprecated']);
const ALLOWED_ACTION_TYPE = Object.freeze(['uri', 'message', 'postback']);
const ALLOWED_SIZE = Object.freeze(['large', 'small']);
const ALLOWED_PLAN_TIER = Object.freeze(['free', 'paid']);
const ALLOWED_LOCALE = Object.freeze(['ja', 'en']);

function normalizeId(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  if (!normalized) return '';
  return normalized.replace(/[^a-zA-Z0-9_\-:.]/g, '_').slice(0, 120);
}

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizeBoolean(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function normalizeInteger(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const parsed = Math.floor(num);
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function normalizeBounds(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const x = normalizeInteger(value.x, null, 0, 2500);
  const y = normalizeInteger(value.y, null, 0, 2500);
  const width = normalizeInteger(value.width, null, 1, 2500);
  const height = normalizeInteger(value.height, null, 1, 2500);
  if ([x, y, width, height].includes(null)) return null;
  return { x, y, width, height };
}

function normalizeArea(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const label = normalizeText(value.label, '');
  const actionTypeRaw = normalizeText(value.actionType, '');
  if (!label || !actionTypeRaw) return null;
  const actionType = actionTypeRaw.toLowerCase();
  if (!ALLOWED_ACTION_TYPE.includes(actionType)) return null;

  const actionPayload = value.actionPayload && typeof value.actionPayload === 'object' && !Array.isArray(value.actionPayload)
    ? Object.assign({}, value.actionPayload)
    : {};

  if (actionType === 'uri') {
    const linkRegistryId = normalizeText(actionPayload.linkRegistryId, '');
    const uri = normalizeText(actionPayload.uri, '');
    if (uri && /^https?:\/\//i.test(uri)) {
      return null;
    }
    if (!linkRegistryId && !uri) return null;
    actionPayload.linkRegistryId = linkRegistryId || null;
    actionPayload.uri = uri || null;
  }
  if (actionType === 'message') {
    const text = normalizeText(actionPayload.text, '');
    if (!text) return null;
    actionPayload.text = text;
  }
  if (actionType === 'postback') {
    const data = normalizeText(actionPayload.data, '');
    if (!data) return null;
    actionPayload.data = data;
    const displayText = normalizeText(actionPayload.displayText, '');
    actionPayload.displayText = displayText || null;
  }

  const bounds = normalizeBounds(value.bounds);
  if (!bounds) return null;

  return {
    label: label.slice(0, 80),
    bounds,
    actionType,
    actionPayload
  };
}

function normalizeLayout(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const sizeRaw = normalizeText(raw.size, 'large');
  if (!sizeRaw) return null;
  const size = sizeRaw.toLowerCase();
  if (!ALLOWED_SIZE.includes(size)) return null;
  const areasRaw = Array.isArray(raw.areas) ? raw.areas : [];
  const areas = [];
  for (const item of areasRaw) {
    const normalized = normalizeArea(item);
    if (!normalized) return null;
    areas.push(normalized);
  }
  if (!areas.length || areas.length > 6) return null;
  return { size, areas };
}

function normalizeTarget(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const planTierRaw = normalizeText(raw.planTier, '');
  const localeRaw = normalizeText(raw.locale, 'ja');
  const phaseId = normalizeText(raw.phaseId, '') || null;

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

function normalizeLineMeta(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const richMenuId = normalizeText(raw.richMenuId, '') || '';
  const aliasId = normalizeText(raw.aliasId, '') || null;
  const imageAssetPath = normalizeText(raw.imageAssetPath, '') || null;
  return {
    richMenuId,
    aliasId,
    imageAssetPath
  };
}

function normalizeRichMenuTemplate(input, idHint) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const templateId = normalizeId(input.templateId || idHint);
  if (!templateId) return null;

  const kindRaw = normalizeText(input.kind, 'default');
  if (!kindRaw) return null;
  const kind = kindRaw.toLowerCase();
  if (!ALLOWED_KIND.includes(kind)) return null;

  const statusRaw = normalizeText(input.status, 'draft');
  if (!statusRaw) return null;
  const status = statusRaw.toLowerCase();
  if (!ALLOWED_STATUS.includes(status)) return null;

  const target = normalizeTarget(input.target);
  const layout = normalizeLayout(input.layout);
  const lineMeta = normalizeLineMeta(input.lineMeta);
  const version = normalizeInteger(input.version, 1, 1, 100000);
  const archived = normalizeBoolean(input.archived, false);

  if ([target, layout, version, archived].includes(null)) return null;

  return {
    templateId,
    kind,
    status,
    target,
    layout,
    lineMeta,
    version,
    archived,
    description: normalizeText(input.description, '') || '',
    labels: Array.isArray(input.labels)
      ? Array.from(new Set(input.labels.map((item) => normalizeText(item, '')).filter(Boolean))).slice(0, 20)
      : []
  };
}

function normalizeTemplateDoc(docId, data) {
  const normalized = normalizeRichMenuTemplate(Object.assign({}, data || {}, { templateId: docId }), docId);
  if (!normalized) return null;
  const payload = data && typeof data === 'object' ? data : {};
  return Object.assign({}, normalized, {
    createdAt: payload.createdAt || null,
    createdBy: normalizeText(payload.createdBy, null),
    updatedAt: payload.updatedAt || null,
    updatedBy: normalizeText(payload.updatedBy, null)
  });
}

async function getRichMenuTemplate(templateId) {
  const id = normalizeId(templateId);
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeTemplateDoc(id, snap.data());
}

async function upsertRichMenuTemplate(template, actor) {
  const normalized = normalizeRichMenuTemplate(template, template && template.templateId);
  if (!normalized) throw new Error('invalid richMenuTemplate');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(normalized.templateId);
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
  return getRichMenuTemplate(normalized.templateId);
}

async function listRichMenuTemplates(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const statusFilter = normalizeText(payload.status, '') || null;
  const limit = normalizeInteger(payload.limit, 100, 1, 500) || 100;
  const db = getDb();
  const snap = await db.collection(COLLECTION).orderBy('updatedAt', 'desc').limit(limit).get();
  const rows = snap.docs.map((doc) => normalizeTemplateDoc(doc.id, doc.data())).filter(Boolean);
  if (!statusFilter) return rows;
  const status = statusFilter.toLowerCase();
  return rows.filter((row) => row.status === status);
}

module.exports = {
  COLLECTION,
  ALLOWED_KIND,
  ALLOWED_STATUS,
  normalizeRichMenuTemplate,
  getRichMenuTemplate,
  upsertRichMenuTemplate,
  listRichMenuTemplates
};
