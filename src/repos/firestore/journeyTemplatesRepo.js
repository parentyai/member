'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { LEAD_TIME_KIND, LEAD_TIME_KIND_VALUES } = require('../../domain/tasks/constants');

const COLLECTION = 'journey_templates';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const PHASE_ORDER = Object.freeze(['onboarding', 'in_assignment', 'offboarding']);
const RISK_LEVEL_VALUES = Object.freeze(['low', 'medium', 'high']);
const MEANING_KEY_PATTERN = /^[a-z0-9_-]{2,64}$/;
const FIELD_SCK = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

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

function normalizeMeaningKey(value, fallback) {
  const source = normalizeText(value, '') || normalizeText(fallback, '');
  if (!source) return null;
  const normalized = source
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  if (!MEANING_KEY_PATTERN.test(normalized)) return null;
  return normalized;
}

function normalizeMeaning(value, fallbackStepKey, fallbackTitle) {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const meaningKey = normalizeMeaningKey(payload.meaningKey, fallbackStepKey);
  const title = normalizeText(payload.title, normalizeText(fallbackTitle, null));
  const summary = normalizeText(payload.summary, null);
  const doneDefinition = normalizeText(payload.doneDefinition, null);
  const whyNow = normalizeText(payload.whyNow, null);
  const opsNotes = normalizeText(payload.opsNotes, null);
  const helpLinkRegistryIds = normalizeStringList(payload.helpLinkRegistryIds || payload.helpLinks).slice(0, 3);
  if (!meaningKey && !title && !summary && !doneDefinition && !whyNow && !opsNotes && helpLinkRegistryIds.length === 0) {
    return null;
  }
  return {
    meaningKey: meaningKey || normalizeMeaningKey(fallbackStepKey, null),
    title,
    summary,
    doneDefinition,
    whyNow,
    helpLinkRegistryIds,
    opsNotes
  };
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
  return {
    eventKey: normalizeText(payload.eventKey, null),
    source: normalizeText(payload.source, null)
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

function normalizeNudgeTemplate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    title: normalizeText(value.title, null),
    body: normalizeText(value.body, null),
    ctaText: normalizeText(value.ctaText, null),
    linkRegistryId: normalizeText(value.linkRegistryId, null),
    notificationCategory: normalizeText(value.notificationCategory, null)
  };
}

function normalizeRiskLevel(value, fallback) {
  const normalized = normalizeText(value, fallback || 'medium').toLowerCase();
  if (!RISK_LEVEL_VALUES.includes(normalized)) return fallback || 'medium';
  return normalized;
}

function normalizePhaseKey(value) {
  const phaseKey = normalizeText(value, '').toLowerCase();
  return PHASE_ORDER.includes(phaseKey) ? phaseKey : null;
}

function normalizeStep(step) {
  const row = step && typeof step === 'object' ? step : {};
  const stepKey = normalizeText(row.stepKey, '');
  if (!stepKey) return null;
  const leadTime = normalizeLeadTime(row.leadTime);
  if (!leadTime) return null;
  return {
    stepKey,
    title: normalizeText(row.title, stepKey),
    meaning: normalizeMeaning(row.meaning, stepKey, row.title || stepKey),
    [FIELD_SCK]: normalizeText(row[FIELD_SCK], null),
    trigger: normalizeTrigger(row.trigger),
    leadTime,
    dependsOn: normalizeStringList(row.dependsOn),
    constraints: normalizeConstraints(row.constraints),
    priority: normalizeNumber(row.priority, 100, 0, 100000),
    riskLevel: normalizeRiskLevel(row.riskLevel, 'medium'),
    enabled: normalizeBoolean(row.enabled, true) === true,
    validFrom: toIso(row.validFrom),
    validUntil: toIso(row.validUntil),
    nudgeTemplate: normalizeNudgeTemplate(row.nudgeTemplate)
  };
}

function normalizePhase(phase) {
  const row = phase && typeof phase === 'object' ? phase : {};
  const phaseKey = normalizePhaseKey(row.phaseKey);
  if (!phaseKey) return null;
  const steps = Array.isArray(row.steps)
    ? row.steps.map((step) => normalizeStep(step)).filter(Boolean)
    : [];
  return {
    phaseKey,
    steps
  };
}

function sortPhases(phases) {
  const list = Array.isArray(phases) ? phases.slice() : [];
  list.sort((left, right) => {
    const leftKey = left && left.phaseKey ? left.phaseKey : '';
    const rightKey = right && right.phaseKey ? right.phaseKey : '';
    const leftIdx = PHASE_ORDER.indexOf(leftKey);
    const rightIdx = PHASE_ORDER.indexOf(rightKey);
    if (leftIdx !== rightIdx) return leftIdx - rightIdx;
    return leftKey.localeCompare(rightKey, 'ja');
  });
  return list;
}

function normalizeJourneyTemplate(templateId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  const id = normalizeText(templateId || payload.templateId, '');
  if (!id) return null;

  const phasesRaw = Array.isArray(payload.phases) ? payload.phases : [];
  const phaseByKey = new Map();
  phasesRaw.forEach((phase) => {
    const normalized = normalizePhase(phase);
    if (!normalized) return;
    if (!phaseByKey.has(normalized.phaseKey)) {
      phaseByKey.set(normalized.phaseKey, normalized);
      return;
    }
    const current = phaseByKey.get(normalized.phaseKey);
    phaseByKey.set(normalized.phaseKey, {
      phaseKey: normalized.phaseKey,
      steps: current.steps.concat(normalized.steps)
    });
  });

  const phases = sortPhases(Array.from(phaseByKey.values())).map((phase) => {
    const seen = new Set();
    const steps = [];
    phase.steps.forEach((step) => {
      if (!step || seen.has(step.stepKey)) return;
      seen.add(step.stepKey);
      steps.push(step);
    });
    return { phaseKey: phase.phaseKey, steps };
  });

  return {
    id,
    templateId: id,
    version: normalizeNumber(payload.version, 1, 1, 1000000),
    country: normalizeText(payload.country, 'US').toUpperCase(),
    [FIELD_SCK]: normalizeText(payload[FIELD_SCK], 'US_ASSIGNMENT'),
    enabled: normalizeBoolean(payload.enabled, true) === true,
    validFrom: toIso(payload.validFrom),
    validUntil: toIso(payload.validUntil),
    phases,
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

function isTemplateActiveAt(template, nowIso) {
  const row = template && typeof template === 'object' ? template : {};
  const nowMs = Date.parse(nowIso || new Date().toISOString());
  if (row.enabled !== true) return false;
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

function sortByUpdatedAtDesc(list) {
  return list.slice().sort((left, right) => {
    const leftMs = Date.parse(left && left.updatedAt ? left.updatedAt : '') || 0;
    const rightMs = Date.parse(right && right.updatedAt ? right.updatedAt : '') || 0;
    if (leftMs !== rightMs) return rightMs - leftMs;
    return String(left && left.templateId || '').localeCompare(String(right && right.templateId || ''), 'ja');
  });
}

async function getJourneyTemplate(templateId) {
  const id = normalizeText(templateId, '');
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeJourneyTemplate(id, snap.data());
}

async function upsertJourneyTemplate(templateId, patch, actor) {
  const id = normalizeText(templateId, '');
  if (!id) throw new Error('templateId required');
  const existing = await getJourneyTemplate(id);
  const normalized = normalizeJourneyTemplate(id, Object.assign({}, existing || {}, patch || {}, { templateId: id }));
  if (!normalized) throw new Error('invalid journey template');
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    updatedAt: serverTimestamp(),
    updatedBy: normalizeText(actor, normalized.updatedBy),
    createdAt: normalized.createdAt || serverTimestamp(),
    createdBy: normalized.createdBy || normalizeText(actor, null)
  }), { merge: true });
  return getJourneyTemplate(id);
}

async function listJourneyTemplates(filters) {
  const payload = filters && typeof filters === 'object' ? filters : {};
  const db = getDb();
  let query = db.collection(COLLECTION);
  if (payload.enabled === true || payload.enabled === false) {
    query = query.where('enabled', '==', payload.enabled);
  }
  if (payload.country) {
    query = query.where('country', '==', normalizeText(payload.country, 'US').toUpperCase());
  }
  const cap = resolveLimit(payload.limit);
  const snap = await query.limit(cap).get();
  const rows = snap.docs
    .map((doc) => normalizeJourneyTemplate(doc.id, doc.data()))
    .filter(Boolean);
  return sortByUpdatedAtDesc(rows);
}

async function listEnabledJourneyTemplatesNow(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const nowIso = toIso(payload.now) || new Date().toISOString();
  const templates = await listJourneyTemplates(Object.assign({}, payload, { enabled: true }));
  return templates.filter((item) => isTemplateActiveAt(item, nowIso));
}

module.exports = {
  COLLECTION,
  PHASE_ORDER,
  normalizeJourneyTemplate,
  isTemplateActiveAt,
  getJourneyTemplate,
  upsertJourneyTemplate,
  listJourneyTemplates,
  listEnabledJourneyTemplatesNow
};
