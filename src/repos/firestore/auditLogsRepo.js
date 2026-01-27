'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'audit_logs';

function resolveTimestamp(at) {
  return at || serverTimestamp();
}

async function appendAuditLog(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const payload = Object.assign({}, data || {}, { createdAt: resolveTimestamp(data && data.createdAt) });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

module.exports = {
  appendAuditLog
};
