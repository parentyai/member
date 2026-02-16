'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const RUNS_COLLECTION = 'notification_test_runs';
const ITEMS_COLLECTION = 'notification_test_run_items';

function resolveTimestamp(at) {
  return at || serverTimestamp();
}

async function createRunWithId(runId, data) {
  if (!runId) throw new Error('runId required');
  const db = getDb();
  const docRef = db.collection(RUNS_COLLECTION).doc(runId);
  const payload = Object.assign({}, data || {}, { createdAt: resolveTimestamp(data && data.createdAt) });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

async function appendRunItem(runId, data) {
  if (!runId) throw new Error('runId required');
  const db = getDb();
  const docRef = db.collection(ITEMS_COLLECTION).doc();
  const payload = Object.assign({}, data || {}, {
    runId,
    createdAt: resolveTimestamp(data && data.createdAt)
  });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

module.exports = {
  createRunWithId,
  appendRunItem
};
