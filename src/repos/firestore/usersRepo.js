'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'users';

function resolveTimestamp(at) {
  return at || serverTimestamp();
}

async function createUser(lineUserId, data) {
  if (!lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(lineUserId);
  const payload = Object.assign({}, data || {}, { createdAt: resolveTimestamp(data && data.createdAt) });
  await docRef.set(payload, { merge: false });
  return { id: lineUserId };
}

async function getUser(lineUserId) {
  if (!lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(lineUserId);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function updateUser(lineUserId, patch) {
  if (!lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(lineUserId);
  await docRef.set(patch || {}, { merge: true });
  return { id: lineUserId };
}

async function setMemberNumber(lineUserId, memberNumber) {
  return updateUser(lineUserId, { memberNumber: memberNumber || null });
}

async function setMemberCardAsset(lineUserId, assetObj) {
  return updateUser(lineUserId, { memberCardAsset: assetObj || null });
}

async function setRidacMembership(lineUserId, params) {
  const payload = params || {};
  const hash = typeof payload.ridacMembershipIdHash === 'string' ? payload.ridacMembershipIdHash : null;
  const last4 = typeof payload.ridacMembershipIdLast4 === 'string' ? payload.ridacMembershipIdLast4 : null;
  const declaredBy = payload.declaredBy === 'ops' ? 'ops' : 'user';
  return updateUser(lineUserId, {
    ridacMembershipIdHash: hash,
    ridacMembershipIdLast4: last4,
    ridacMembershipDeclaredAt: serverTimestamp(),
    ridacMembershipDeclaredBy: declaredBy
  });
}

async function clearRidacMembership(lineUserId, params) {
  const payload = params || {};
  const unlinkedBy = payload.unlinkedBy === 'ops' ? 'ops' : 'user';
  return updateUser(lineUserId, {
    ridacMembershipIdHash: null,
    ridacMembershipIdLast4: null,
    ridacMembershipUnlinkedAt: serverTimestamp(),
    ridacMembershipUnlinkedBy: unlinkedBy
  });
}

async function setOpsReview(lineUserId, reviewedBy) {
  if (!lineUserId) throw new Error('lineUserId required');
  const actor = reviewedBy && String(reviewedBy).trim().length > 0 ? reviewedBy : 'unknown';
  return updateUser(lineUserId, {
    opsReviewLastReviewedAt: serverTimestamp(),
    opsReviewLastReviewedBy: actor
  });
}

function hasMemberNumber(user) {
  return Boolean(user && typeof user.memberNumber === 'string' && user.memberNumber.trim().length > 0);
}

async function listUsers(params) {
  const db = getDb();
  const opts = params || {};
  let query = db.collection(COLLECTION);
  if (opts.scenarioKey) query = query.where('scenarioKey', '==', opts.scenarioKey);
  if (opts.stepKey) query = query.where('stepKey', '==', opts.stepKey);
  if (opts.region) query = query.where('region', '==', opts.region);
  query = query.orderBy('createdAt', 'desc');
  const limit = typeof opts.limit === 'number' ? opts.limit : 500;
  if (limit) query = query.limit(limit);
  const snap = await query.get();
  let users = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  if (opts.membersOnly) {
    users = users.filter(hasMemberNumber);
  }
  return users;
}

async function listUsersByMemberNumber(memberNumber, limit) {
  const value = typeof memberNumber === 'string' ? memberNumber.trim() : '';
  if (!value) return [];
  const db = getDb();
  let query = db.collection(COLLECTION).where('memberNumber', '==', value);
  const cap = typeof limit === 'number' ? limit : 20;
  if (cap) query = query.limit(cap);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  createUser,
  getUser,
  updateUser,
  setMemberNumber,
  setMemberCardAsset,
  setRidacMembership,
  clearRidacMembership,
  setOpsReview,
  listUsers,
  listUsersByMemberNumber
};
