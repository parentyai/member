'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'journey_graph_change_logs';

function normalizeText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1000000000000 ? value : value * 1000).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function normalizeCatalogSummary(value) {
  const payload = value && typeof value === 'object' ? value : {};
  const edges = Array.isArray(payload.edges) ? payload.edges : [];
  const requiredEdgeCountFromCatalog = edges.filter((edge) => edge && edge.required !== false).length;
  const optionalEdgeCountFromCatalog = edges.filter((edge) => edge && edge.required === false).length;
  const reactionBranchCountFromCatalog = Array.isArray(payload.ruleSet && payload.ruleSet.reactionBranches)
    ? payload.ruleSet.reactionBranches.length
    : 0;
  const freeUnlock = payload.planUnlocks && payload.planUnlocks.free && typeof payload.planUnlocks.free === 'object'
    ? payload.planUnlocks.free
    : {};
  const proUnlock = payload.planUnlocks && payload.planUnlocks.pro && typeof payload.planUnlocks.pro === 'object'
    ? payload.planUnlocks.pro
    : {};
  return {
    enabled: payload.enabled === true,
    schemaVersion: Number.isFinite(Number(payload.schemaVersion)) ? Math.floor(Number(payload.schemaVersion)) : null,
    nodeCount: Array.isArray(payload.nodes) ? payload.nodes.length : Number.isFinite(Number(payload.nodeCount)) ? Math.floor(Number(payload.nodeCount)) : 0,
    edgeCount: Array.isArray(payload.edges) ? payload.edges.length : Number.isFinite(Number(payload.edgeCount)) ? Math.floor(Number(payload.edgeCount)) : 0,
    requiredEdgeCount: Number.isFinite(Number(payload.requiredEdgeCount))
      ? Math.floor(Number(payload.requiredEdgeCount))
      : requiredEdgeCountFromCatalog,
    optionalEdgeCount: Number.isFinite(Number(payload.optionalEdgeCount))
      ? Math.floor(Number(payload.optionalEdgeCount))
      : optionalEdgeCountFromCatalog,
    reactionBranchCount: Number.isFinite(Number(payload.reactionBranchCount))
      ? Math.floor(Number(payload.reactionBranchCount))
      : reactionBranchCountFromCatalog,
    freeMaxNextActions: Number.isFinite(Number(payload.freeMaxNextActions))
      ? Math.floor(Number(payload.freeMaxNextActions))
      : (Number.isFinite(Number(freeUnlock.maxNextActions)) ? Math.floor(Number(freeUnlock.maxNextActions)) : null),
    proMaxNextActions: Number.isFinite(Number(payload.proMaxNextActions))
      ? Math.floor(Number(payload.proMaxNextActions))
      : (Number.isFinite(Number(proUnlock.maxNextActions)) ? Math.floor(Number(proUnlock.maxNextActions)) : null)
  };
}

function normalizeChangeLog(docId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    id: docId,
    actor: normalizeText(payload.actor, 'unknown'),
    traceId: normalizeText(payload.traceId, null),
    requestId: normalizeText(payload.requestId, null),
    planHash: normalizeText(payload.planHash, null),
    catalog: payload.catalog && typeof payload.catalog === 'object' ? payload.catalog : {},
    summary: normalizeCatalogSummary(payload.summary || payload.catalog),
    createdAt: normalizeDate(payload.createdAt),
    updatedAt: payload.updatedAt || null
  };
}

function buildLogId() {
  return `journey_graph_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

async function appendJourneyGraphChangeLog(payload) {
  const entry = payload && typeof payload === 'object' ? payload : {};
  const id = buildLogId();
  const db = getDb();
  const normalized = normalizeChangeLog(id, Object.assign({}, entry, {
    createdAt: entry.createdAt || new Date().toISOString()
  }));
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    updatedAt: serverTimestamp()
  }), { merge: true });
  return normalized;
}

function resolveLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 20;
  return Math.min(Math.floor(parsed), 100);
}

async function listJourneyGraphChangeLogs(limit) {
  const cap = resolveLimit(limit);
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(cap)
    .get();
  return snap.docs.map((doc) => normalizeChangeLog(doc.id, doc.data()));
}

module.exports = {
  COLLECTION,
  normalizeChangeLog,
  appendJourneyGraphChangeLog,
  listJourneyGraphChangeLogs
};
