'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'ops_segments';
const KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
const ALLOWED_STATUSES = new Set(['active', 'archived']);

function resolveTimestamp() {
  return serverTimestamp();
}

function normalizeKey(key) {
  if (typeof key !== 'string' || key.trim().length === 0) throw new Error('segmentKey required');
  const trimmed = key.trim();
  if (!KEY_PATTERN.test(trimmed)) throw new Error('invalid segmentKey');
  return trimmed;
}

function normalizeStatus(status, fallback) {
  if (status === undefined || status === null || status === '') return fallback;
  const value = String(status).trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(value)) throw new Error('invalid status');
  return value;
}

async function getSegmentByKey(segmentKey) {
  const key = normalizeKey(segmentKey);
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .where('segmentKey', '==', key)
    .limit(1)
    .get();
  if (!snap.docs.length) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

async function createSegment(data) {
  const payload = data || {};
  const segmentKey = normalizeKey(payload.segmentKey);
  const status = normalizeStatus(payload.status, 'active');
  const existing = await getSegmentByKey(segmentKey);
  if (existing) throw new Error('segment exists');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const record = Object.assign({}, payload, {
    segmentKey,
    status,
    createdAt: resolveTimestamp(),
    updatedAt: resolveTimestamp()
  });
  await docRef.set(record, { merge: false });
  return { id: docRef.id };
}

async function listSegments(options) {
  const opts = options || {};
  const db = getDb();
  const status = opts.status ? normalizeStatus(opts.status, null) : null;
  let query = db.collection(COLLECTION);
  if (status) query = query.where('status', '==', status);
  query = query.orderBy('createdAt', 'desc');
  const cap = typeof opts.limit === 'number' ? opts.limit : 50;
  if (cap) query = query.limit(cap);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  createSegment,
  listSegments,
  getSegmentByKey
};
