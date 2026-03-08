'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const COLLECTION = 'memory_task';

async function putTaskMemory(lineUserId, payload) {
  if (!lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(String(lineUserId));
  await docRef.set({
    lineUserId: String(lineUserId),
    lane: 'task',
    data: payload && typeof payload === 'object' ? payload : {},
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { id: docRef.id };
}

module.exports = { COLLECTION, putTaskMemory };
