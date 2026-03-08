'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const COLLECTION = 'memory_session';

async function putSessionMemory(lineUserId, payload) {
  if (!lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(String(lineUserId));
  await docRef.set({
    lineUserId: String(lineUserId),
    lane: 'session',
    data: payload && typeof payload === 'object' ? payload : {},
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { id: docRef.id };
}

module.exports = { COLLECTION, putSessionMemory };
