'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'step_rule_change_logs';

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const num = Math.floor(parsed);
  if (Number.isFinite(min) && num < min) return fallback;
  if (Number.isFinite(max) && num > max) return fallback;
  return num;
}

async function appendStepRuleChangeLog(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  await docRef.set(Object.assign({}, payload, {
    actor: normalizeText(payload.actor, 'unknown'),
    action: normalizeText(payload.action, 'upsert'),
    ruleId: normalizeText(payload.ruleId, null),
    createdAt: payload.createdAt || serverTimestamp()
  }), { merge: false });
  return { id: docRef.id };
}

async function listStepRuleChangeLogs(limit) {
  const cap = normalizeNumber(limit, 20, 1, 200);
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(cap)
    .get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  COLLECTION,
  appendStepRuleChangeLog,
  listStepRuleChangeLogs
};
