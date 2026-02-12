'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'redac_membership_links';

async function getLinkByHash(redacMembershipIdHash) {
  const hash = typeof redacMembershipIdHash === 'string' ? redacMembershipIdHash.trim() : '';
  if (!hash) throw new Error('redacMembershipIdHash required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(hash).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function setLink(redacMembershipIdHash, data) {
  const hash = typeof redacMembershipIdHash === 'string' ? redacMembershipIdHash.trim() : '';
  if (!hash) throw new Error('redacMembershipIdHash required');
  const payload = data || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(hash);
  const record = Object.assign({}, payload, {
    redacMembershipIdHash: hash,
    linkedAt: serverTimestamp(),
    linkedBy: payload.linkedBy || 'user'
  });
  await docRef.set(record, { merge: false });
  return { id: hash };
}

async function deleteLink(redacMembershipIdHash) {
  const hash = typeof redacMembershipIdHash === 'string' ? redacMembershipIdHash.trim() : '';
  if (!hash) throw new Error('redacMembershipIdHash required');
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

