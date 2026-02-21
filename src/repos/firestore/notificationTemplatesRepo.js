'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { normalizeNotificationCategory } = require('../../domain/notificationCategory');
const { isMissingIndexError, sortByTimestampDesc } = require('./queryFallback');
const { recordMissingIndexFallback, shouldFailOnMissingIndex } = require('./indexFallbackPolicy');

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

async function createTemplate(data) {
  const payload = data || {};
  const key = normalizeKey(payload.key);
  const status = normalizeStatus(payload.status, 'draft');
  const notificationCategory = normalizeNotificationCategory(payload.notificationCategory);
  const db = getDb();
  const existing = await getTemplateByKey(key);
  if (existing) throw new Error('template exists');
  const docRef = db.collection(COLLECTION).doc();
  const record = Object.assign({}, payload, {
    key,
    status,
    notificationCategory,
    createdAt: resolveTimestamp()
  });
  await docRef.set(record, { merge: false });
  return { id: docRef.id };
}

async function listTemplates(options) {
  const db = getDb();
  const opts = typeof options === 'number' ? { limit: options } : (options || {});
  const status = opts.status ? normalizeStatus(opts.status, null) : null;
  let baseQuery = db.collection(COLLECTION);
  if (status) baseQuery = baseQuery.where('status', '==', status);
  let query = baseQuery.orderBy('createdAt', 'desc');
  const cap = typeof opts.limit === 'number' ? opts.limit : 50;
  if (cap) query = query.limit(cap);
  try {
    const snap = await query.get();
    return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    recordMissingIndexFallback({
      repo: 'notificationTemplatesRepo',
      query: 'listTemplates',
      err
    });
    if (shouldFailOnMissingIndex()) throw err;
    // Fallback for environments without composite indexes.
    const snap = await baseQuery.get();
    const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    sortByTimestampDesc(rows, 'createdAt');
    return cap ? rows.slice(0, cap) : rows;
  }
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
    const updates = {};
    const fields = ['title', 'body', 'ctaText', 'linkRegistryId', 'text'];
    for (const field of fields) {
      if (payload[field] !== undefined) updates[field] = payload[field];
    }
    if (payload.notificationCategory !== undefined) {
      updates.notificationCategory = normalizeNotificationCategory(payload.notificationCategory);
    }
    updates.updatedAt = resolveTimestamp();
    const db = getDb();
    await db.collection(COLLECTION).doc(template.id).set(updates, { merge: true });
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
    const db = getDb();
    await db.collection(COLLECTION).doc(template.id).set({
      status: next,
      updatedAt: resolveTimestamp()
    }, { merge: true });
    return { id: template.id, status: next };
  }
};
