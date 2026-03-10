'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');
const { appendCanonicalCoreOutboxEvent } = require('./canonicalCoreOutboxRepo');

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

function resolveLifecycleStateFromResult(result) {
  if (typeof result !== 'string') return 'candidate';
  const normalized = result.trim().toLowerCase();
  if (normalized === 'ok') return 'approved';
  return 'candidate';
}

function resolveLifecycleBucketFromState(state) {
  if (state === 'approved') return 'approved_knowledge';
  return 'candidate_knowledge';
}

function buildSourceEvidenceEnvelope(evidenceId, payload) {
  const normalized = payload && typeof payload === 'object' ? payload : {};
  return buildUniversalRecordEnvelope({
    recordId: evidenceId,
    recordType: 'evidence_claim',
    sourceSystem: 'member_firestore',
    sourceSnapshotRef: `source_evidence:${evidenceId}`,
    effectiveFrom: normalized.checkedAt || new Date().toISOString(),
    effectiveTo: null,
    authorityTier: 'UNKNOWN',
    bindingLevel: 'REFERENCE',
    jurisdiction: null,
    status: 'active',
    retentionTag: 'source_evidence_indefinite',
    piiClass: 'none',
    accessScope: ['operator', 'audit'],
    maskingPolicy: 'none',
    deletionPolicy: 'retention_policy_v1'
  });
}

async function createEvidence(data) {
  const payload = normalizePayload(data);
  if (!payload.sourceRefId) throw new Error('sourceRefId required');
  if (!payload.traceId) throw new Error('traceId required');
  const id = resolveId(data);
  const lifecycleState = resolveLifecycleStateFromResult(payload.result);
  const lifecycleBucket = resolveLifecycleBucketFromState(lifecycleState);
  const recordEnvelope = buildSourceEvidenceEnvelope(id, payload);
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, payload, {
    recordEnvelope,
    createdAt: serverTimestamp()
  }), { merge: false });

  await appendCanonicalCoreOutboxEvent({
    objectType: 'evidence_claim',
    objectId: id,
    eventType: 'upsert',
    recordEnvelope,
    payloadSummary: {
      lifecycleState,
      lifecycleBucket,
      status: payload.result
    },
    traceId: payload.traceId
  });
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
  const snap = await baseQuery.orderBy('checkedAt', 'desc').limit(cap).get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

async function listEvidenceByTraceId(traceId, limit) {
  if (!traceId) throw new Error('traceId required');
  const cap = Number.isFinite(Number(limit)) ? Math.min(Math.max(Math.floor(Number(limit)), 1), 100) : 20;
  const db = getDb();
  const baseQuery = db.collection(COLLECTION).where('traceId', '==', traceId);
  const snap = await baseQuery.orderBy('checkedAt', 'desc').limit(cap).get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  createEvidence,
  getEvidence,
  listEvidenceBySourceRef,
  listEvidenceByTraceId
};
