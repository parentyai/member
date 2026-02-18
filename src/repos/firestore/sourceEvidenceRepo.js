'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { isMissingIndexError, sortByTimestampDesc } = require('./queryFallback');

const COLLECTION = 'source_evidence';

function normalizeScreenshotPaths(values) {
  if (!Array.isArray(values)) return [];
  return values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim());
}

function normalizePayload(data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    sourceRefId: typeof payload.sourceRefId === 'string' ? payload.sourceRefId.trim() : '',
    checkedAt: payload.checkedAt || new Date().toISOString(),
    result: typeof payload.result === 'string' ? payload.result.trim() : 'error',
    statusCode: Number.isFinite(Number(payload.statusCode)) ? Number(payload.statusCode) : null,
    finalUrl: typeof payload.finalUrl === 'string' ? payload.finalUrl.trim() : null,
    contentHash: typeof payload.contentHash === 'string' ? payload.contentHash.trim() : null,
    screenshotPaths: normalizeScreenshotPaths(payload.screenshotPaths),
    diffSummary: typeof payload.diffSummary === 'string' ? payload.diffSummary.trim() : null,
    traceId: typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null,
    llm_used: Boolean(payload.llm_used),
    model: typeof payload.model === 'string' ? payload.model.trim() : null,
    promptVersion: typeof payload.promptVersion === 'string' ? payload.promptVersion.trim() : null
  };
}

function resolveId(data) {
  const payload = data && typeof data === 'object' ? data : {};
  if (typeof payload.id === 'string' && payload.id.trim()) return payload.id.trim();
  return `se_${crypto.randomUUID()}`;
}

async function createEvidence(data) {
  const payload = normalizePayload(data);
  if (!payload.sourceRefId) throw new Error('sourceRefId required');
  if (!payload.traceId) throw new Error('traceId required');
  const id = resolveId(data);
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, payload, { createdAt: serverTimestamp() }), { merge: false });
  return { id };
}

async function getEvidence(evidenceId) {
  if (!evidenceId) throw new Error('evidenceId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(evidenceId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listEvidenceBySourceRef(sourceRefId, limit) {
  if (!sourceRefId) throw new Error('sourceRefId required');
  const cap = Number.isFinite(Number(limit)) ? Math.min(Math.max(Math.floor(Number(limit)), 1), 100) : 20;
  const db = getDb();
  const baseQuery = db.collection(COLLECTION).where('sourceRefId', '==', sourceRefId);
  try {
    const snap = await baseQuery.orderBy('checkedAt', 'desc').limit(cap).get();
    return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    const snap = await baseQuery.get();
    const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    sortByTimestampDesc(rows, 'checkedAt');
    return rows.slice(0, cap);
  }
}

module.exports = {
  createEvidence,
  getEvidence,
  listEvidenceBySourceRef
};
