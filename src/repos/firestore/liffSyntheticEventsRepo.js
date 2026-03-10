'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');
const { assertRecordEnvelopeCompliance } = require('../../domain/data/universalRecordEnvelopeCompliance');

const COLLECTION = 'liff_synthetic_events';

function normalizeString(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

async function appendLiffSyntheticEventRecord(entry) {
  const payload = entry && typeof entry === 'object' ? entry : {};
  const webhookEventId = normalizeString(payload.webhookEventId, '');
  if (!webhookEventId) throw new Error('webhookEventId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(webhookEventId);
  const nowIso = new Date().toISOString();
  const createdAt = payload.createdAt || nowIso;
  const updatedAt = payload.updatedAt || createdAt;
  const lineUserId = normalizeString(payload.lineUserId, null);
  const traceId = normalizeString(payload.traceId, null);
  const sourceType = normalizeString(payload.sourceType, 'user');
  const processStatus = Number.isFinite(Number(payload.processStatus)) ? Number(payload.processStatus) : null;
  const processReason = normalizeString(payload.processReason, null);

  const data = {
    webhookEventId,
    traceId,
    lineUserId,
    sourceType,
    synthetic: true,
    origin: 'liff_silent_path',
    processStatus,
    processReason,
    createdAt: payload.createdAt || serverTimestamp(),
    updatedAt: payload.updatedAt || serverTimestamp(),
    recordEnvelope: buildUniversalRecordEnvelope({
      recordId: docRef.id,
      recordType: 'liff_synthetic_event',
      sourceSystem: 'member_firestore',
      sourceSnapshotRef: 'snapshot:liff_synthetic_events',
      effectiveFrom: createdAt,
      authorityTier: 'T2_PUBLIC_DATA',
      bindingLevel: 'REFERENCE',
      status: 'active',
      retentionTag: 'liff_synthetic_events_180d',
      piiClass: 'indirect_identifier',
      accessScope: ['operator', 'admin'],
      maskingPolicy: 'liff_payload_masked',
      deletionPolicy: 'retention_policy_v1',
      createdAt,
      updatedAt
    })
  };
  assertRecordEnvelopeCompliance({ dataClass: 'liff_synthetic_events', recordEnvelope: data.recordEnvelope });

  await docRef.set(data, { merge: true });
  return { id: docRef.id };
}

module.exports = {
  COLLECTION,
  appendLiffSyntheticEventRecord
};
