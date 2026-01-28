'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'events';

async function createEvent(data) {
  const payload = data || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');
  if (!payload.type) throw new Error('type required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const record = Object.assign({}, payload, { createdAt: serverTimestamp() });
  await docRef.set(record, { merge: false });
  return { id: docRef.id };
}

module.exports = {
  createEvent
};
