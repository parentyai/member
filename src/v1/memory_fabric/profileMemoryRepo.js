'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');
const { assertRecordEnvelopeCompliance } = require('../../domain/data/universalRecordEnvelopeCompliance');
const COLLECTION = 'memory_profile';

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

async function putProfileMemory(lineUserId, payload) {
  const normalizedLineUserId = normalizeLineUserId(lineUserId);
  if (!normalizedLineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(String(normalizedLineUserId));
  const nowIso = new Date().toISOString();
  const recordEnvelope = buildUniversalRecordEnvelope({
    recordId: docRef.id,
    recordType: 'memory_profile',
    sourceSystem: 'member_firestore',
    sourceSnapshotRef: 'snapshot:memory_profile',
    effectiveFrom: nowIso,
    authorityTier: 'T2_PUBLIC_DATA',
    bindingLevel: 'REFERENCE',
    status: 'active',
    retentionTag: 'memory_profile_365d',
    piiClass: 'indirect_identifier',
    accessScope: ['system', 'operator_limited'],
    maskingPolicy: 'memory_payload_masked_strict',
    deletionPolicy: 'retention_policy_v1',
    createdAt: nowIso,
    updatedAt: nowIso
  });
  assertRecordEnvelopeCompliance({ dataClass: 'memory_profile', recordEnvelope });
  await docRef.set({
    lineUserId: String(normalizedLineUserId),
    lane: 'profile',
    data: payload && typeof payload === 'object' ? payload : {},
    recordEnvelope,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { id: docRef.id };
}

async function getProfileMemory(lineUserId) {
  const normalizedLineUserId = normalizeLineUserId(lineUserId);
  if (!normalizedLineUserId) return null;
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(normalizedLineUserId).get();
  if (!doc.exists) return null;
  const data = doc.data() || {};
  return {
    id: doc.id,
    lineUserId: typeof data.lineUserId === 'string' ? data.lineUserId : normalizedLineUserId,
    lane: data.lane === 'profile' ? data.lane : 'profile',
    data: data.data && typeof data.data === 'object' ? data.data : {},
    recordEnvelope: data.recordEnvelope && typeof data.recordEnvelope === 'object' ? data.recordEnvelope : null,
    updatedAt: data.updatedAt || null
  };
}

module.exports = { COLLECTION, putProfileMemory, getProfileMemory };
