'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { normalizeOpsStateRecord, resolveOpsStateReadOrder } = require('../../domain/normalizers/opsStateNormalizer');

// DEPRECATED:
// - legacy collection: ops_state
// - canonical collection: ops_states
// This repo is kept only as a compatibility bridge.
const LEGACY_COLLECTION = 'ops_state';
const CANONICAL_COLLECTION = 'ops_states';
const DOC_ID = 'global';

function resolveTimestamp(at) {
  if (!at) return serverTimestamp();
  if (at instanceof Date) return at;
  if (typeof at.toDate === 'function') return at.toDate();
  if (typeof at === 'string' || typeof at === 'number') {
    const date = new Date(at);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return serverTimestamp();
}

async function getOpsState() {
  const db = getDb();
  const readOrder = resolveOpsStateReadOrder();
  for (const collection of readOrder) {
    const docRef = db.collection(collection).doc(DOC_ID);
    const snap = await docRef.get();
    if (!snap.exists) continue;
    const normalized = normalizeOpsStateRecord(snap.data());
    return Object.assign({ id: snap.id, collection }, normalized);
  }
  return null;
}

async function setOpsReview(params) {
  const payload = params || {};
  const reviewedBy = payload.reviewedBy;
  if (!reviewedBy) throw new Error('reviewedBy required');
  const db = getDb();
  const docRef = db.collection(CANONICAL_COLLECTION).doc(DOC_ID);
  await docRef.set({
    lastReviewedAt: resolveTimestamp(payload.reviewedAt),
    lastReviewedBy: reviewedBy
  }, { merge: true });
  return { id: DOC_ID };
}

module.exports = {
  getOpsState,
  setOpsReview
};
