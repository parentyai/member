'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'notices';
const ALLOWED_STATUSES = new Set(['draft', 'active', 'archived']);

function resolveTimestamp() {
  return serverTimestamp();
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} required`);
  }
  return value.trim();
}

function normalizeStatus(status, fallback) {
  if (status === undefined || status === null || status === '') return fallback;
  const value = String(status).trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(value)) throw new Error('invalid status');
  return value;
}

async function createNotice(data) {
  const payload = data || {};
  const title = requireString(payload.title, 'title');
  const body = requireString(payload.body, 'body');
  const status = normalizeStatus(payload.status, 'draft');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const record = {
    title,
    body,
    status,
    createdAt: resolveTimestamp(),
    updatedAt: resolveTimestamp()
  };
  await docRef.set(record, { merge: false });
  return { id: docRef.id };
}

async function getNotice(id) {
  if (!id) throw new Error('noticeId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listNotices(options) {
  const opts = options || {};
  const status = opts.status ? normalizeStatus(opts.status, null) : null;
  const db = getDb();
  let query = db.collection(COLLECTION);
  if (status) query = query.where('status', '==', status);
  query = query.orderBy('createdAt', 'desc');
  const limit = typeof opts.limit === 'number' ? opts.limit : 50;
  if (limit) query = query.limit(limit);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

async function updateNoticeStatus(id, status) {
  if (!id) throw new Error('noticeId required');
  const next = normalizeStatus(status, null);
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set({
    status: next,
    updatedAt: resolveTimestamp()
  }, { merge: true });
  return { id, status: next };
}

module.exports = {
  createNotice,
  getNotice,
  listNotices,
  updateNoticeStatus
};
