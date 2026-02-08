'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'templates_v';
const KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
const ALLOWED_STATUSES = new Set(['draft', 'active', 'archived']);

function resolveTimestamp() {
  return serverTimestamp();
}

function normalizeKey(key) {
  if (typeof key !== 'string' || key.trim().length === 0) throw new Error('templateKey required');
  const trimmed = key.trim();
  if (!KEY_PATTERN.test(trimmed)) throw new Error('invalid templateKey');
  return trimmed;
}

function normalizeStatus(status, fallback) {
  if (status === undefined || status === null || status === '') return fallback;
  const value = String(status).trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(value)) throw new Error('invalid status');
  return value;
}

function normalizeVersion(version) {
  const num = Number(version);
  if (!Number.isFinite(num) || num <= 0) throw new Error('invalid version');
  return Math.floor(num);
}

function normalizeContent(content) {
  if (!content || typeof content !== 'object') throw new Error('content required');
  return content;
}

async function getLatestTemplateVersion(templateKey) {
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .where('templateKey', '==', templateKey)
    .orderBy('version', 'desc')
    .limit(1)
    .get();
  if (!snap.docs.length) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

async function createTemplateVersion(data) {
  const payload = data || {};
  const templateKey = normalizeKey(payload.templateKey);
  const status = normalizeStatus(payload.status, 'draft');
  const content = normalizeContent(payload.content);
  const latest = await getLatestTemplateVersion(templateKey);
  const nextVersion = latest && typeof latest.version === 'number' ? latest.version + 1 : 1;
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const record = {
    templateKey,
    version: nextVersion,
    status,
    content,
    createdAt: resolveTimestamp(),
    updatedAt: resolveTimestamp()
  };
  await docRef.set(record, { merge: false });
  return { id: docRef.id, version: nextVersion };
}

async function getActiveTemplate(params) {
  const payload = params || {};
  const templateKey = normalizeKey(payload.templateKey);
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .where('templateKey', '==', templateKey)
    .where('status', '==', 'active')
    .orderBy('version', 'desc')
    .limit(1)
    .get();
  if (!snap.docs.length) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

async function getTemplateByVersion(params) {
  const payload = params || {};
  const templateKey = normalizeKey(payload.templateKey);
  const version = normalizeVersion(payload.version);
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .where('templateKey', '==', templateKey)
    .where('version', '==', version)
    .limit(1)
    .get();
  if (!snap.docs.length) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

module.exports = {
  createTemplateVersion,
  getActiveTemplate,
  getTemplateByVersion
};
