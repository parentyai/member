'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');
const { assertRecordEnvelopeCompliance } = require('../../domain/data/universalRecordEnvelopeCompliance');

const COLLECTION = 'delivery_records';

async function appendDeliveryRecord(entry) {
  const payload = entry && typeof entry === 'object' ? entry : {};
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(payload.id || `delivery_${crypto.randomUUID()}`);
  const nowIso = new Date().toISOString();
  const recordEnvelope = buildUniversalRecordEnvelope({
    recordId: docRef.id,
    recordType: 'delivery_record',
    sourceSystem: 'member_firestore',
    sourceSnapshotRef: typeof payload.sourceSnapshotRef === 'string' && payload.sourceSnapshotRef.trim()
      ? payload.sourceSnapshotRef.trim()
      : 'snapshot:delivery_records',
    effectiveFrom: payload.createdAt || nowIso,
    authorityTier: 'T2_PUBLIC_DATA',
    bindingLevel: 'REFERENCE',
    status: 'active',
    retentionTag: 'delivery_records_180d',
    piiClass: 'indirect_identifier',
    accessScope: ['operator', 'admin'],
    maskingPolicy: 'delivery_payload_masked',
    deletionPolicy: 'retention_policy_v1',
    createdAt: payload.createdAt || nowIso,
    updatedAt: payload.updatedAt || payload.createdAt || nowIso
  });
  assertRecordEnvelopeCompliance({ dataClass: 'delivery_records', recordEnvelope });
  await docRef.set(Object.assign({}, payload, {
    recordEnvelope,
    createdAt: payload.createdAt || serverTimestamp(),
    updatedAt: payload.updatedAt || serverTimestamp()
  }), { merge: true });
  return { id: docRef.id };
}

module.exports = {
  COLLECTION,
  appendDeliveryRecord
};
