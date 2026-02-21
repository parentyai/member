'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { isMissingIndexError, sortByTimestampDesc } = require('./queryFallback');
const { recordMissingIndexFallback, shouldFailOnMissingIndex } = require('./indexFallbackPolicy');

const COLLECTION = 'send_retry_queue';
const STATUS_VALUES = new Set(['PENDING', 'DONE', 'GAVE_UP']);

function resolveTimestamp() {
  return serverTimestamp();
}

function normalizeStatus(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toUpperCase();
  if (!STATUS_VALUES.has(normalized)) throw new Error('invalid status');
  return normalized;
}

async function enqueueFailure(data) {
  const payload = data || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');
  if (!payload.templateKey) throw new Error('templateKey required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const record = Object.assign({}, payload, {
    status: normalizeStatus(payload.status, 'PENDING'),
    createdAt: resolveTimestamp(),
    updatedAt: resolveTimestamp()
  });
  await docRef.set(record, { merge: false });
  return { id: docRef.id };
}

async function getQueueItem(id) {
  if (!id) throw new Error('queueId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listPending(limit) {
  const db = getDb();
  const baseQuery = db.collection(COLLECTION).where('status', '==', 'PENDING');
  let query = baseQuery.orderBy('createdAt', 'desc');
  const cap = typeof limit === 'number' ? limit : 50;
  if (cap) query = query.limit(cap);
  try {
    const snap = await query.get();
    return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    recordMissingIndexFallback({
      repo: 'sendRetryQueueRepo',
      query: 'listPending',
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

async function markDone(id) {
  if (!id) throw new Error('queueId required');
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set({
    status: 'DONE',
    updatedAt: resolveTimestamp()
  }, { merge: true });
  return { id, status: 'DONE' };
}

async function markFailed(id, error) {
  if (!id) throw new Error('queueId required');
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set({
    status: 'PENDING',
    lastError: error || 'send_failed',
    updatedAt: resolveTimestamp()
  }, { merge: true });
  return { id, status: 'PENDING' };
}

module.exports = {
  enqueueFailure,
  getQueueItem,
  listPending,
  markDone,
  markFailed
};
