'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'user_checklists';

function buildDocId(lineUserId, checklistId, itemId) {
  return `${lineUserId}__${checklistId}__${itemId}`;
}

async function upsertUserChecklist(params) {
  const data = params || {};
  const { lineUserId, checklistId, itemId } = data;
  if (!lineUserId) throw new Error('lineUserId required');
  if (!checklistId) throw new Error('checklistId required');
  if (!itemId) throw new Error('itemId required');
  const db = getDb();
  const docId = buildDocId(lineUserId, checklistId, itemId);
  const docRef = db.collection(COLLECTION).doc(docId);
  const payload = {
    lineUserId,
    checklistId,
    itemId,
    completedAt: data.completedAt === undefined ? null : data.completedAt,
    updatedAt: serverTimestamp()
  };
  await docRef.set(payload, { merge: true });
  return { id: docId };
}

async function getUserChecklist(lineUserId, checklistId, itemId) {
  if (!lineUserId) throw new Error('lineUserId required');
  if (!checklistId) throw new Error('checklistId required');
  if (!itemId) throw new Error('itemId required');
  const db = getDb();
  const docId = buildDocId(lineUserId, checklistId, itemId);
  const docRef = db.collection(COLLECTION).doc(docId);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listUserChecklists(params) {
  const opts = params || {};
  if (!opts.lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  let query = db.collection(COLLECTION).where('lineUserId', '==', opts.lineUserId);
  if (opts.checklistId) query = query.where('checklistId', '==', opts.checklistId);
  query = query.orderBy('updatedAt', 'desc');
  const limit = typeof opts.limit === 'number' ? opts.limit : 200;
  if (limit) query = query.limit(limit);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  buildDocId,
  upsertUserChecklist,
  getUserChecklist,
  listUserChecklists
};
