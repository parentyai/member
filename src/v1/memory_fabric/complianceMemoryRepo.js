'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');
const COLLECTION = 'memory_compliance';

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

async function putComplianceMemory(lineUserId, payload) {
  const normalizedLineUserId = normalizeLineUserId(lineUserId);
  if (!normalizedLineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(String(normalizedLineUserId));
  const nowIso = new Date().toISOString();
  await docRef.set({
    lineUserId: String(normalizedLineUserId),
    lane: 'compliance',
    data: payload && typeof payload === 'object' ? payload : {},
    recordEnvelope: buildUniversalRecordEnvelope({
      recordId: docRef.id,
      recordType: 'memory_compliance',
      sourceSystem: 'member_firestore',
      sourceSnapshotRef: 'snapshot:memory_compliance',
      effectiveFrom: nowIso,
      authorityTier: 'T1_OFFICIAL_OPERATION',
      bindingLevel: 'POLICY',
      status: 'active',
      retentionTag: 'memory_compliance_365d',
      piiClass: 'regulated_context',
      accessScope: ['system', 'admin'],
      maskingPolicy: 'memory_payload_masked_strict',
      deletionPolicy: 'retention_policy_v1',
      createdAt: nowIso,
      updatedAt: nowIso
    }),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { id: docRef.id };
}

async function getComplianceMemory(lineUserId) {
  const normalizedLineUserId = normalizeLineUserId(lineUserId);
  if (!normalizedLineUserId) return null;
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(normalizedLineUserId).get();
  if (!doc.exists) return null;
  const data = doc.data() || {};
  return {
    id: doc.id,
    lineUserId: typeof data.lineUserId === 'string' ? data.lineUserId : normalizedLineUserId,
    lane: data.lane === 'compliance' ? data.lane : 'compliance',
    data: data.data && typeof data.data === 'object' ? data.data : {},
    recordEnvelope: data.recordEnvelope && typeof data.recordEnvelope === 'object' ? data.recordEnvelope : null,
    updatedAt: data.updatedAt || null
  };
}

module.exports = { COLLECTION, putComplianceMemory, getComplianceMemory };
