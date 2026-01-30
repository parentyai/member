'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'ops_state';
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
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function setOpsReview(params) {
  const payload = params || {};
  const reviewedBy = payload.reviewedBy;
  if (!reviewedBy) throw new Error('reviewedBy required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
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
