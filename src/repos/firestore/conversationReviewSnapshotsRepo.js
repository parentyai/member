'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');
const { assertRecordEnvelopeCompliance } = require('../../domain/data/universalRecordEnvelopeCompliance');

const COLLECTION = 'conversation_review_snapshots';

function resolveTimestamp(at) {
  return at || serverTimestamp();
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeOptionalText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeTextPolicy(policy) {
  const source = policy && typeof policy === 'object' ? policy : {};
  const normalized = {};
  ['userMessage', 'assistantReply', 'priorContextSummary'].forEach((key) => {
    const row = source[key] && typeof source[key] === 'object' ? source[key] : {};
    normalized[key] = {
      originalLength: Number.isFinite(Number(row.originalLength)) ? Number(row.originalLength) : 0,
      storedLength: Number.isFinite(Number(row.storedLength)) ? Number(row.storedLength) : 0,
      truncated: row.truncated === true,
      replacements: Array.isArray(row.replacements)
        ? row.replacements
          .map((item) => {
            const label = normalizeText(item && item.label);
            const count = Number.isFinite(Number(item && item.count)) ? Number(item.count) : 0;
            if (!label) return null;
            return { label, count: Math.max(0, Math.floor(count)) };
          })
          .filter(Boolean)
          .slice(0, 8)
        : []
    };
  });
  return normalized;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1000000000000 ? value : value * 1000);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date;
  }
  return null;
}

async function appendConversationReviewSnapshot(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const nowIso = new Date().toISOString();
  const recordEnvelope = buildUniversalRecordEnvelope({
    recordId: docRef.id,
    recordType: 'conversation_review_snapshot',
    sourceSystem: 'member_firestore',
    sourceSnapshotRef: 'snapshot:conversation_review_snapshots',
    effectiveFrom: payload.createdAt || nowIso,
    authorityTier: 'T2_PUBLIC_DATA',
    bindingLevel: 'RECOMMENDED',
    status: 'active',
    retentionTag: 'conversation_review_snapshots_180d',
    piiClass: 'indirect_identifier',
    accessScope: ['operator', 'quality_patrol'],
    maskingPolicy: 'quality_patrol_transcript_masked_v1',
    deletionPolicy: 'retention_policy_v1',
    createdAt: payload.createdAt || nowIso,
    updatedAt: payload.createdAt || nowIso
  });
  assertRecordEnvelopeCompliance({
    dataClass: 'conversation_review_snapshots',
    recordEnvelope
  });

  const row = {
    snapshotVersion: normalizeText(payload.snapshotVersion) || 'quality_patrol_review_snapshot_v1',
    lineUserKey: normalizeText(payload.lineUserKey),
    traceId: normalizeOptionalText(payload.traceId),
    requestId: normalizeOptionalText(payload.requestId),
    routeKind: normalizeOptionalText(payload.routeKind),
    domainIntent: normalizeOptionalText(payload.domainIntent),
    strategy: normalizeOptionalText(payload.strategy),
    selectedCandidateKind: normalizeOptionalText(payload.selectedCandidateKind),
    fallbackTemplateKind: normalizeOptionalText(payload.fallbackTemplateKind),
    replyTemplateFingerprint: normalizeOptionalText(payload.replyTemplateFingerprint),
    priorContextUsed: payload.priorContextUsed === true,
    followupResolvedFromHistory: payload.followupResolvedFromHistory === true,
    knowledgeCandidateUsed: payload.knowledgeCandidateUsed === true,
    readinessDecision: normalizeOptionalText(payload.readinessDecision),
    genericFallbackSlice: normalizeOptionalText(payload.genericFallbackSlice),
    userMessageMasked: normalizeOptionalText(payload.userMessageMasked),
    assistantReplyMasked: normalizeOptionalText(payload.assistantReplyMasked),
    priorContextSummaryMasked: normalizeOptionalText(payload.priorContextSummaryMasked),
    userMessageAvailable: payload.userMessageAvailable === true,
    assistantReplyAvailable: payload.assistantReplyAvailable === true,
    priorContextSummaryAvailable: payload.priorContextSummaryAvailable === true,
    textPolicy: normalizeTextPolicy(payload.textPolicy),
    createdAt: resolveTimestamp(payload.createdAt),
    recordEnvelope
  };

  await docRef.set(row, { merge: false });
  return { id: docRef.id };
}

async function listConversationReviewSnapshotsByCreatedAtRange(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(payload.limit)) ? Math.min(Math.max(Math.floor(Number(payload.limit)), 1), 500) : 100;
  const fromAt = toDate(payload.fromAt);
  const toAt = toDate(payload.toAt);
  const db = getDb();
  const snap = await db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs
    .map((doc) => Object.assign({ id: doc.id }, doc.data()))
    .filter((row) => {
      const at = toDate(row && row.createdAt);
      if (!at) return false;
      if (fromAt && at.getTime() < fromAt.getTime()) return false;
      if (toAt && at.getTime() > toAt.getTime()) return false;
      return true;
    });
}

async function listConversationReviewSnapshotsByTraceId(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const traceId = normalizeText(payload.traceId);
  if (!traceId) return [];
  const limit = Number.isFinite(Number(payload.limit)) ? Math.min(Math.max(Math.floor(Number(payload.limit)), 1), 200) : 50;
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('traceId', '==', traceId).limit(limit).get();
  return snap.docs
    .map((doc) => Object.assign({ id: doc.id }, doc.data()))
    .sort((left, right) => {
      const leftAt = toDate(left && left.createdAt);
      const rightAt = toDate(right && right.createdAt);
      return (rightAt ? rightAt.getTime() : 0) - (leftAt ? leftAt.getTime() : 0);
    })
    .slice(0, limit);
}

async function listConversationReviewSnapshotsByLineUserKey(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserKey = normalizeText(payload.lineUserKey);
  if (!lineUserKey) return [];
  const limit = Number.isFinite(Number(payload.limit)) ? Math.min(Math.max(Math.floor(Number(payload.limit)), 1), 200) : 50;
  const fromAt = toDate(payload.fromAt);
  const toAt = toDate(payload.toAt);
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('lineUserKey', '==', lineUserKey).limit(limit).get();
  return snap.docs
    .map((doc) => Object.assign({ id: doc.id }, doc.data()))
    .filter((row) => {
      const at = toDate(row && row.createdAt);
      if (!at) return false;
      if (fromAt && at.getTime() < fromAt.getTime()) return false;
      if (toAt && at.getTime() > toAt.getTime()) return false;
      return true;
    })
    .sort((left, right) => {
      const leftAt = toDate(left && left.createdAt);
      const rightAt = toDate(right && right.createdAt);
      return (rightAt ? rightAt.getTime() : 0) - (leftAt ? leftAt.getTime() : 0);
    })
    .slice(0, limit);
}

module.exports = {
  COLLECTION,
  appendConversationReviewSnapshot,
  listConversationReviewSnapshotsByCreatedAtRange,
  listConversationReviewSnapshotsByTraceId,
  listConversationReviewSnapshotsByLineUserKey,
  toDate
};
