'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { normalizeNotificationCategory } = require('../../domain/notificationCategory');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');
const { appendCanonicalCoreOutboxEvent } = require('./canonicalCoreOutboxRepo');
const {
  normalizeExceptionPlaybookMetadata,
  buildExceptionPlaybookCanonicalPayload,
  buildExceptionPlaybookSourceLinks
} = require('../../domain/data/canonicalCoreExceptionPlaybookMapping');

const COLLECTION = 'notification_templates';
const KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
const ALLOWED_STATUSES = new Set(['draft', 'active', 'inactive']);

function resolveTimestamp() {
  return serverTimestamp();
}

function normalizeKey(key) {
  if (typeof key !== 'string' || key.trim().length === 0) throw new Error('key required');
  const trimmed = key.trim();
  if (!KEY_PATTERN.test(trimmed)) throw new Error('invalid key');
  return trimmed;
}

function normalizeStatus(status, fallback) {
  if (status === undefined || status === null || status === '') return fallback;
  const value = String(status).trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(value)) throw new Error('invalid status');
  return value;
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function sortByCreatedAtDesc(rows) {
  return rows.slice().sort((a, b) => toMillis(b && b.createdAt) - toMillis(a && a.createdAt));
}

function normalizeText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function buildNotificationTemplateEnvelope(templateId, template, existingEnvelope) {
  const payload = template && typeof template === 'object' ? template : {};
  const previousCreatedAt = existingEnvelope && typeof existingEnvelope === 'object'
    ? existingEnvelope.created_at
    : null;
  const status = normalizeStatus(payload.status, 'draft');
  return buildUniversalRecordEnvelope({
    recordId: templateId,
    recordType: 'notification_template',
    sourceSystem: 'member_firestore',
    sourceSnapshotRef: `notification_templates:${templateId}`,
    effectiveFrom: previousCreatedAt || new Date().toISOString(),
    effectiveTo: null,
    authorityTier: 'UNKNOWN',
    bindingLevel: 'REFERENCE',
    jurisdiction: payload.exceptionPlaybook && payload.exceptionPlaybook.scopeKey ? payload.exceptionPlaybook.scopeKey : null,
    status: status === 'inactive' ? 'deprecated' : status,
    retentionTag: 'notification_templates_indefinite',
    piiClass: 'none',
    accessScope: ['operator', 'ops'],
    maskingPolicy: 'none',
    deletionPolicy: 'retention_policy_v1',
    createdAt: previousCreatedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function normalizeTemplatePayload(templateId, data, existingTemplate) {
  const payload = data && typeof data === 'object' ? data : {};
  const base = existingTemplate && typeof existingTemplate === 'object' ? existingTemplate : {};
  const key = normalizeKey(payload.key !== undefined ? payload.key : base.key);
  const status = normalizeStatus(payload.status !== undefined ? payload.status : base.status, 'draft');
  const notificationCategory = normalizeNotificationCategory(
    payload.notificationCategory !== undefined ? payload.notificationCategory : base.notificationCategory
  );
  const next = Object.assign({}, base, payload, {
    key,
    status,
    notificationCategory
  });
  if (payload.exceptionPlaybook !== undefined) {
    const normalized = normalizeExceptionPlaybookMetadata(payload.exceptionPlaybook, {
      template: Object.assign({}, next, { status }),
      templateId,
      status
    });
    if (!normalized) throw new Error('invalid exceptionPlaybook');
    next.exceptionPlaybook = normalized;
  } else if (base.exceptionPlaybook) {
    next.exceptionPlaybook = normalizeExceptionPlaybookMetadata(base.exceptionPlaybook, {
      template: Object.assign({}, next, { status }),
      templateId,
      status
    });
  }
  next.recordEnvelope = buildNotificationTemplateEnvelope(templateId, next, base.recordEnvelope);
  return next;
}

async function appendExceptionPlaybookEvent(templateId, templateRecord) {
  const canonicalPayload = buildExceptionPlaybookCanonicalPayload(
    templateId,
    templateRecord,
    templateRecord && templateRecord.recordEnvelope
  );
  if (!canonicalPayload) return { skipped: true, reason: 'exception_playbook_missing' };
  const exceptionCode = normalizeText(
    canonicalPayload.exceptionPlaybook && canonicalPayload.exceptionPlaybook.exceptionCode,
    templateId
  );
  return appendCanonicalCoreOutboxEvent({
    objectType: 'exception_playbook',
    objectId: `exception_playbook:${exceptionCode}`,
    eventType: 'upsert',
    recordEnvelope: templateRecord.recordEnvelope,
    canonicalPayload,
    sourceLinks: buildExceptionPlaybookSourceLinks(templateId, templateRecord),
    materializationHints: {
      targetTables: ['exception_playbook']
    },
    payloadSummary: {
      lifecycleState: templateRecord.status === 'active' ? 'approved' : 'candidate',
      lifecycleBucket: 'ops_exception_playbook',
      status: templateRecord.status,
      riskLevel: canonicalPayload.exceptionPlaybook.severity
    }
  });
}

async function createTemplate(data) {
  const payload = data || {};
  const key = normalizeKey(payload.key);
  const db = getDb();
  const existing = await getTemplateByKey(key);
  if (existing) throw new Error('template exists');
  const docRef = db.collection(COLLECTION).doc();
  const record = normalizeTemplatePayload(docRef.id, payload);
  record.createdAt = resolveTimestamp();
  await docRef.set(record, { merge: false });
  await appendExceptionPlaybookEvent(docRef.id, record);
  return { id: docRef.id };
}

async function listTemplates(options) {
  const db = getDb();
  const opts = typeof options === 'number' ? { limit: options } : (options || {});
  const status = opts.status ? normalizeStatus(opts.status, null) : null;
  const cap = typeof opts.limit === 'number' ? opts.limit : 50;
  let baseQuery = db.collection(COLLECTION);
  if (status) baseQuery = baseQuery.where('status', '==', status);
  let query = baseQuery;
  if (cap) query = query.limit(cap);
  const snap = await query.get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  const sorted = sortByCreatedAtDesc(rows);
  return cap ? sorted.slice(0, cap) : sorted;
}

async function getTemplateByKey(key) {
  const normalized = normalizeKey(key);
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .where('key', '==', normalized)
    .limit(1)
    .get();
  if (!snap.docs.length) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

module.exports = {
  createTemplate,
  listTemplates,
  getTemplateByKey,
  async updateTemplate(key, patch) {
    const normalized = normalizeKey(key);
    const payload = patch && typeof patch === 'object' ? patch : {};
    const template = await getTemplateByKey(normalized);
    if (!template) throw new Error('template not found');
    const status = template.status || 'draft';
    if (status !== 'draft') throw new Error('template not editable');
    const next = normalizeTemplatePayload(template.id, Object.assign({}, template, payload), template);
    const updates = {
      updatedAt: resolveTimestamp(),
      recordEnvelope: next.recordEnvelope
    };
    ['title', 'body', 'ctaText', 'linkRegistryId', 'text', 'notificationCategory'].forEach((field) => {
      if (next[field] !== undefined) updates[field] = next[field];
    });
    if (next.exceptionPlaybook) updates.exceptionPlaybook = next.exceptionPlaybook;
    const db = getDb();
    await db.collection(COLLECTION).doc(template.id).set(updates, { merge: true });
    await appendExceptionPlaybookEvent(template.id, Object.assign({}, template, updates, {
      status: template.status
    }));
    return { id: template.id };
  },
  async setStatus(key, status) {
    const normalized = normalizeKey(key);
    const next = normalizeStatus(status, null);
    const template = await getTemplateByKey(normalized);
    if (!template) throw new Error('template not found');
    const current = template.status || 'draft';
    const allowed = (
      (current === 'draft' && (next === 'draft' || next === 'active')) ||
      (current === 'active' && (next === 'draft' || next === 'inactive')) ||
      (current === 'inactive' && next === 'inactive')
    );
    if (!allowed) throw new Error('invalid status transition');
    const nextRecord = normalizeTemplatePayload(template.id, Object.assign({}, template, { status: next }), template);
    const db = getDb();
    await db.collection(COLLECTION).doc(template.id).set({
      status: next,
      recordEnvelope: nextRecord.recordEnvelope,
      updatedAt: resolveTimestamp()
    }, { merge: true });
    await appendExceptionPlaybookEvent(template.id, Object.assign({}, template, {
      status: next,
      recordEnvelope: nextRecord.recordEnvelope,
      exceptionPlaybook: nextRecord.exceptionPlaybook || template.exceptionPlaybook || null
    }));
    return { id: template.id, status: next };
  }
};
