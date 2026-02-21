'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { isMissingIndexError, sortByTimestampDesc } = require('./queryFallback');
const { normalizeScenarioKey } = require('../../domain/normalizers/scenarioKeyNormalizer');
const { recordMissingIndexFallback, shouldFailOnMissingIndex } = require('./indexFallbackPolicy');

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

async function setRedacMembership(lineUserId, params) {
  const payload = params || {};
  const hash = typeof payload.redacMembershipIdHash === 'string' ? payload.redacMembershipIdHash : null;
  const last4 = typeof payload.redacMembershipIdLast4 === 'string' ? payload.redacMembershipIdLast4 : null;
  const declaredBy = payload.declaredBy === 'ops' ? 'ops' : 'user';
  return updateUser(lineUserId, {
    redacMembershipIdHash: hash,
    redacMembershipIdLast4: last4,
    redacMembershipDeclaredAt: serverTimestamp(),
    redacMembershipDeclaredBy: declaredBy
  });
}

async function clearRedacMembership(lineUserId, params) {
  const payload = params || {};
  const unlinkedBy = payload.unlinkedBy === 'ops' ? 'ops' : 'user';
  return updateUser(lineUserId, {
    redacMembershipIdHash: null,
    redacMembershipIdLast4: null,
    redacMembershipUnlinkedAt: serverTimestamp(),
    redacMembershipUnlinkedBy: unlinkedBy
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
  const normalizedScenarioKey = normalizeScenarioKey({
    scenarioKey: opts.scenarioKey,
    scenario: opts.scenario
  });
  let baseQuery = db.collection(COLLECTION);
  if (normalizedScenarioKey) baseQuery = baseQuery.where('scenarioKey', '==', normalizedScenarioKey);
  if (opts.stepKey) baseQuery = baseQuery.where('stepKey', '==', opts.stepKey);
  if (opts.region) baseQuery = baseQuery.where('region', '==', opts.region);
  let query = baseQuery.orderBy('createdAt', 'desc');
  const limit = typeof opts.limit === 'number' ? opts.limit : 500;
  if (limit) query = query.limit(limit);
  let users = [];
  try {
    const snap = await query.get();
    users = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    recordMissingIndexFallback({
      repo: 'usersRepo',
      query: 'listUsers',
      err
    });
    if (shouldFailOnMissingIndex()) throw err;
    // Fallback for environments without composite indexes.
    const snap = await baseQuery.get();
    users = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    sortByTimestampDesc(users, 'createdAt');
    if (limit) users = users.slice(0, limit);
  }
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
  setRedacMembership,
  clearRedacMembership,
  setOpsReview,
  listUsers,
  listUsersByMemberNumber
};
