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

module.exports = {
  COLLECTION,
  appendConversationReviewSnapshot
};
