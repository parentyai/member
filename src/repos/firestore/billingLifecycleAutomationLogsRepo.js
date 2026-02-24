'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'billing_lifecycle_automation_logs';

function normalizeString(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizeActions(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  value.forEach((item) => {
    if (typeof item !== 'string') return;
    const normalized = item.trim();
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

async function appendBillingLifecycleAutomationLog(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const data = {
    lineUserId: normalizeString(payload.lineUserId, ''),
    stripeEventId: normalizeString(payload.stripeEventId, null),
    prevStatus: normalizeString(payload.prevStatus, 'unknown'),
    nextStatus: normalizeString(payload.nextStatus, 'unknown'),
    transition: normalizeString(payload.transition, null),
    actionsApplied: normalizeActions(payload.actionsApplied),
    decision: normalizeString(payload.decision, 'unknown'),
    error: normalizeString(payload.error, null),
    createdAt: payload.createdAt || serverTimestamp()
  };
  await docRef.set(data, { merge: false });
  return { id: docRef.id, data };
}

module.exports = {
  COLLECTION,
  appendBillingLifecycleAutomationLog
};
