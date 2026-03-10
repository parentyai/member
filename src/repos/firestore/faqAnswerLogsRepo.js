'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { sanitizeFaqAuditPayload } = require('../../domain/audit/faqAuditPayloadGuard');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');

const COLLECTION = 'faq_answer_logs';

function resolveTimestamp(at) {
  return at || serverTimestamp();
}

async function appendFaqAnswerLog(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const sanitized = sanitizeFaqAuditPayload(data);
  const createdAt = resolveTimestamp(sanitized && sanitized.createdAt);
  const payload = Object.assign({}, sanitized, {
    createdAt,
    recordEnvelope: buildUniversalRecordEnvelope({
      recordId: docRef.id,
      recordType: 'faq_answer_log',
      sourceSystem: 'member_firestore',
      sourceSnapshotRef: sanitized && typeof sanitized.sourceSnapshotRef === 'string' && sanitized.sourceSnapshotRef.trim()
        ? sanitized.sourceSnapshotRef.trim()
        : 'snapshot:faq_answer_logs',
      effectiveFrom: sanitized && sanitized.createdAt ? sanitized.createdAt : new Date().toISOString(),
      authorityTier: 'T2_PUBLIC_DATA',
      bindingLevel: 'RECOMMENDED',
      status: 'active',
      retentionTag: 'faq_answer_logs_180d',
      piiClass: 'indirect_identifier',
      accessScope: ['operator', 'faq_runtime'],
      maskingPolicy: 'faq_payload_masked',
      deletionPolicy: 'retention_policy_v1',
      createdAt: sanitized && sanitized.createdAt ? sanitized.createdAt : new Date().toISOString(),
      updatedAt: sanitized && sanitized.createdAt ? sanitized.createdAt : new Date().toISOString()
    })
  });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

async function listFaqAnswerLogs(params) {
  const payload = params || {};
  const limit = Number.isFinite(Number(payload.limit)) ? Math.min(Math.max(Math.floor(Number(payload.limit)), 1), 500) : 100;
  const sinceAtMs = payload.sinceAt ? toMillis(payload.sinceAt) : 0;
  const db = getDb();
  let query = db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(limit);
  const snap = await query.get();
  const items = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  if (!sinceAtMs) return items;
  return items.filter((item) => toMillis(item.createdAt) >= sinceAtMs);
}

module.exports = {
  appendFaqAnswerLog,
  listFaqAnswerLogs
};
