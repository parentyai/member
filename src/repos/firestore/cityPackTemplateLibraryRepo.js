'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { isMissingIndexError, sortByTimestampDesc } = require('./queryFallback');

const COLLECTION = 'city_pack_template_library';
const ALLOWED_STATUS = new Set(['draft', 'active', 'retired']);

function normalizeStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_STATUS.has(status) ? status : 'draft';
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeTemplate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return JSON.parse(JSON.stringify(value));
}

function resolveId(payload) {
  if (payload && typeof payload.id === 'string' && payload.id.trim()) return payload.id.trim();
  return `cptl_${crypto.randomUUID()}`;
}

function normalizePayload(data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    id: resolveId(payload),
    status: normalizeStatus(payload.status),
    name: normalizeString(payload.name),
    schemaVersion: normalizeString(payload.schemaVersion) || 'city_pack_template_v1',
    template: normalizeTemplate(payload.template),
    source: normalizeString(payload.source) || 'manual',
    traceId: normalizeString(payload.traceId),
    requestId: normalizeString(payload.requestId)
  };
}

async function createTemplate(data) {
  const payload = normalizePayload(data);
  if (!payload.name) throw new Error('name required');
  if (!payload.template) throw new Error('template required');
  if (!payload.traceId) throw new Error('traceId required');
  const db = getDb();
  await db.collection(COLLECTION).doc(payload.id).set({
    status: payload.status,
    name: payload.name,
    schemaVersion: payload.schemaVersion,
    template: payload.template,
    source: payload.source,
    traceId: payload.traceId,
    requestId: payload.requestId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    activatedAt: null,
    retiredAt: null
  }, { merge: false });
  return { id: payload.id };
}

async function getTemplate(templateId) {
  if (!templateId) throw new Error('templateId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(templateId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function updateTemplate(templateId, patch) {
  if (!templateId) throw new Error('templateId required');
  const payload = patch && typeof patch === 'object' ? Object.assign({}, patch) : {};
  payload.updatedAt = serverTimestamp();
  const db = getDb();
  await db.collection(COLLECTION).doc(templateId).set(payload, { merge: true });
  return { id: templateId };
}

async function listTemplates(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(opts.limit)) ? Math.min(Math.max(Math.floor(Number(opts.limit)), 1), 200) : 50;
  let baseQuery = getDb().collection(COLLECTION);
  if (opts.status) baseQuery = baseQuery.where('status', '==', normalizeStatus(opts.status));
  let rows;
  try {
    const snap = await baseQuery.orderBy('updatedAt', 'desc').limit(limit).get();
    rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    const snap = await baseQuery.get();
    rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    sortByTimestampDesc(rows, 'updatedAt');
    rows = rows.slice(0, limit);
  }
  return rows;
}

module.exports = {
  normalizeStatus,
  createTemplate,
  getTemplate,
  updateTemplate,
  listTemplates
};

