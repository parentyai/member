'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');
const COLLECTION = 'memory_session';

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

async function putSessionMemory(lineUserId, payload) {
  const normalizedLineUserId = normalizeLineUserId(lineUserId);
  if (!normalizedLineUserId) throw new Error('lineUserId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(String(normalizedLineUserId));
  const nowIso = new Date().toISOString();
  await docRef.set({
    lineUserId: String(normalizedLineUserId),
    lane: 'session',
    data: payload && typeof payload === 'object' ? payload : {},
    recordEnvelope: buildUniversalRecordEnvelope({
      recordId: docRef.id,
      recordType: 'memory_session',
      sourceSystem: 'member_firestore',
      sourceSnapshotRef: 'snapshot:memory_session',
      effectiveFrom: nowIso,
      authorityTier: 'T2_PUBLIC_DATA',
      bindingLevel: 'REFERENCE',
      status: 'active',
      retentionTag: 'memory_session_90d',
      piiClass: 'indirect_identifier',
      accessScope: ['system', 'operator_limited'],
      maskingPolicy: 'memory_payload_masked',
      deletionPolicy: 'retention_policy_v1',
      createdAt: nowIso,
      updatedAt: nowIso
    }),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { id: docRef.id };
}

async function getSessionMemory(lineUserId) {
  const normalizedLineUserId = normalizeLineUserId(lineUserId);
  if (!normalizedLineUserId) return null;
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(normalizedLineUserId).get();
  if (!doc.exists) return null;
  const data = doc.data() || {};
  return {
    id: doc.id,
    lineUserId: typeof data.lineUserId === 'string' ? data.lineUserId : normalizedLineUserId,
    lane: data.lane === 'session' ? data.lane : 'session',
    data: data.data && typeof data.data === 'object' ? data.data : {},
    recordEnvelope: data.recordEnvelope && typeof data.recordEnvelope === 'object' ? data.recordEnvelope : null,
    updatedAt: data.updatedAt || null
  };
}

module.exports = { COLLECTION, putSessionMemory, getSessionMemory };
