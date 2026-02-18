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

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

async function listFaqAnswerLogs(params) {
  const payload = params || {};
  const limit = Number.isFinite(Number(payload.limit)) ? Math.min(Math.max(Math.floor(Number(payload.limit)), 1), 500) : 100;
  const sinceAtMs = payload.sinceAt ? toMillis(payload.sinceAt) : 0;
  const db = getDb();
  let query = db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(limit);
  const snap = await query.get();
  const items = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  if (!sinceAtMs) return items;
  return items.filter((item) => toMillis(item.createdAt) >= sinceAtMs);
}

module.exports = {
  appendFaqAnswerLog,
  listFaqAnswerLogs
};
