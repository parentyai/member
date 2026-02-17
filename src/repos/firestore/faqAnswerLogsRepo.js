'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'faq_answer_logs';

function resolveTimestamp(at) {
  return at || serverTimestamp();
}

async function appendFaqAnswerLog(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const payload = Object.assign({}, data || {}, { createdAt: resolveTimestamp(data && data.createdAt) });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

module.exports = {
  appendFaqAnswerLog
};
