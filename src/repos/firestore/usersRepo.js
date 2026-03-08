'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'users';
const FIELD_CANON = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);
const FIELD_LEGACY = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111);

function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveTimestamp(at) {
  return at || serverTimestamp();
}

function resolveCanonKey(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const canon = normalizeString(source[FIELD_CANON]);
  const legacy = normalizeString(source[FIELD_LEGACY]);
  return canon || legacy || null;
}

function shouldSupplementCanon(payload, existing) {
  const current = payload && typeof payload === 'object' ? payload : {};
  const existingRecord = existing && typeof existing === 'object' ? existing : {};
  const incomingCanon = normalizeString(current[FIELD_CANON]);
  if (incomingCanon) return null;
  const existingCanon = normalizeString(existingRecord[FIELD_CANON]);
  if (existingCanon) return null;
  return resolveCanonKey(current);
}

async function createUser(lineUserId, data) {
  if (!lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(lineUserId);
  const payload = Object.assign({}, data || {}, { createdAt: resolveTimestamp(data && data.createdAt) });
  const normalized = shouldSupplementCanon(payload, null);
  if (normalized) payload[FIELD_CANON] = normalized;
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
  const payload = Object.assign({}, patch || {});
  const currentSnap = await docRef.get();
  const current = currentSnap.exists ? currentSnap.data() : null;
  const normalized = shouldSupplementCanon(payload, current);
  if (normalized) payload[FIELD_CANON] = normalized;
  await docRef.set(payload, { merge: true });
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
    ridacMembershipIdHash: null,
    ridacMembershipIdLast4: null,
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
    ridacMembershipIdHash: null,
    ridacMembershipIdLast4: null,
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

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function sortUsersByCreatedAtDesc(rows) {
  return (rows || []).slice().sort((a, b) => toMillis(b && b.createdAt) - toMillis(a && a.createdAt));
}

async function listUsers(params) {
  const db = getDb();
  const opts = params || {};
  const normalized = resolveCanonKey(opts);
  let baseQuery = db.collection(COLLECTION);
  if (normalized) baseQuery = baseQuery.where(FIELD_CANON, '==', normalized);
  if (opts.stepKey) baseQuery = baseQuery.where('stepKey', '==', opts.stepKey);
  if (opts.region) baseQuery = baseQuery.where('region', '==', opts.region);
  let query = baseQuery;
  const limit = typeof opts.limit === 'number' ? opts.limit : 500;
  if (limit) query = query.limit(limit);
  let users = [];
  const snap = await query.get();
  users = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  users = sortUsersByCreatedAtDesc(users);
  if (opts.membersOnly) {
    users = users.filter(hasMemberNumber);
  }
  if (limit) users = users.slice(0, limit);
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
