'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'rich_menu_rollout_runs';

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizeLineUserIds(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach((item) => {
    const normalized = normalizeText(item, '');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function buildRunId(action) {
  const prefix = normalizeText(action, 'run').replace(/[^a-zA-Z0-9_\-:.]/g, '_').slice(0, 20);
  return `richmenu_${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeRunDoc(docId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    runId: docId,
    action: normalizeText(payload.action, 'unknown'),
    mode: normalizeText(payload.mode, 'apply'),
    actor: normalizeText(payload.actor, 'unknown'),
    traceId: normalizeText(payload.traceId, null),
    requestId: normalizeText(payload.requestId, null),
    lineUserIds: normalizeLineUserIds(payload.lineUserIds),
    summary: payload.summary && typeof payload.summary === 'object' ? payload.summary : {},
    results: Array.isArray(payload.results) ? payload.results : [],
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null
  };
}

async function appendRichMenuRolloutRun(payload) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const runId = buildRunId(input.action || input.mode || 'run');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(runId);
  const normalized = normalizeRunDoc(runId, Object.assign({}, input));
  await docRef.set(Object.assign({}, normalized, {
    createdAt: normalized.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  }), { merge: true });
  return getRichMenuRolloutRun(runId);
}

async function getRichMenuRolloutRun(runId) {
  const id = normalizeText(runId, '');
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeRunDoc(id, snap.data());
}

function normalizeLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return 20;
  return Math.min(Math.floor(num), 200);
}

async function listRichMenuRolloutRuns(limit) {
  const cap = normalizeLimit(limit);
  const db = getDb();
  const snap = await db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(cap).get();
  return snap.docs.map((doc) => normalizeRunDoc(doc.id, doc.data()));
}

module.exports = {
  COLLECTION,
  appendRichMenuRolloutRun,
  getRichMenuRolloutRun,
  listRichMenuRolloutRuns
};
