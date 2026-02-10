'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'ridac_membership_links';

async function getLinkByHash(ridacMembershipIdHash) {
  const hash = typeof ridacMembershipIdHash === 'string' ? ridacMembershipIdHash.trim() : '';
  if (!hash) throw new Error('ridacMembershipIdHash required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(hash).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function setLink(ridacMembershipIdHash, data) {
  const hash = typeof ridacMembershipIdHash === 'string' ? ridacMembershipIdHash.trim() : '';
  if (!hash) throw new Error('ridacMembershipIdHash required');
  const payload = data || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(hash);
  const record = Object.assign({}, payload, {
    ridacMembershipIdHash: hash,
    linkedAt: serverTimestamp(),
    linkedBy: payload.linkedBy || 'user'
  });
  await docRef.set(record, { merge: false });
  return { id: hash };
}

async function deleteLink(ridacMembershipIdHash) {
  const hash = typeof ridacMembershipIdHash === 'string' ? ridacMembershipIdHash.trim() : '';
  if (!hash) throw new Error('ridacMembershipIdHash required');
  const db = getDb();
  await db.collection(COLLECTION).doc(hash).delete();
  return { id: hash };
}

module.exports = {
  COLLECTION,
  getLinkByHash,
  setLink,
  deleteLink
};

