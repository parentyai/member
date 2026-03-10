'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');
const { assertRecordEnvelopeCompliance } = require('../../domain/data/universalRecordEnvelopeCompliance');

const COLLECTION = 'llm_quality_logs';
const QUALITY_SLICE_KEYS = new Set([
  'paid',
  'free',
  'admin',
  'compat',
  'short_followup',
  'domain_continuation',
  'group_chat',
  'japanese_service_quality',
  'minority_personas',
  'cultural_slices'
]);
const CONTAMINATION_RISKS = new Set(['low', 'medium', 'high']);
const REPLAY_FAILURE_TYPES = new Set([
  'none',
  'stale_source',
  'contradictory_source',
  'evidence_swap',
  'quote_unsend',
  'redelivery'
]);

function normalizeString(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeSliceKey(value) {
  const text = normalizeString(value, '').toLowerCase();
  if (!text) return null;
  return QUALITY_SLICE_KEYS.has(text) ? text : null;
}

function normalizeContaminationRisk(value) {
  const text = normalizeString(value, '').toLowerCase();
  if (!text) return null;
  return CONTAMINATION_RISKS.has(text) ? text : null;
}

function normalizeReplayFailureType(value) {
  const text = normalizeString(value, '').toLowerCase();
  if (!text) return 'none';
  return REPLAY_FAILURE_TYPES.has(text) ? text : 'none';
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

async function appendLlmQualityLog(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const recordEnvelope = buildUniversalRecordEnvelope({
    recordId: docRef.id,
    recordType: 'llm_quality_log',
    sourceSystem: 'member_firestore',
    sourceSnapshotRef: normalizeString(payload.sourceSnapshotRef, 'snapshot:llm_quality_logs'),
    effectiveFrom: payload.createdAt || new Date().toISOString(),
    authorityTier: normalizeString(payload.authorityTier, 'T2_PUBLIC_DATA'),
    bindingLevel: normalizeString(payload.bindingLevel, 'RECOMMENDED'),
    status: 'active',
    retentionTag: 'llm_quality_logs_180d',
    piiClass: 'indirect_identifier',
    accessScope: ['operator', 'quality_gate'],
    maskingPolicy: 'quality_payload_masked',
    deletionPolicy: 'retention_policy_v1',
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || payload.createdAt || new Date().toISOString()
  });
  assertRecordEnvelopeCompliance({ dataClass: 'llm_quality_logs', recordEnvelope });
  const data = {
    userId: normalizeString(payload.userId, ''),
    intent: normalizeString(payload.intent, 'faq_search'),
    decision: normalizeString(payload.decision, 'blocked'),
    blockedReason: normalizeString(payload.blockedReason, null),
    top1Score: normalizeNumber(payload.top1Score, null),
    top2Score: normalizeNumber(payload.top2Score, null),
    citationCount: Math.max(0, Math.floor(normalizeNumber(payload.citationCount, 0))),
    retryCount: Math.max(0, Math.floor(normalizeNumber(payload.retryCount, 0))),
    model: normalizeString(payload.model, null),
    sliceKey: normalizeSliceKey(payload.sliceKey),
    judgeConfidence: Math.max(0, Math.min(1, normalizeNumber(payload.judgeConfidence, 0))),
    judgeDisagreement: Math.max(0, Math.min(1, normalizeNumber(payload.judgeDisagreement, 0))),
    benchmarkVersion: normalizeString(payload.benchmarkVersion, null),
    contaminationRisk: normalizeContaminationRisk(payload.contaminationRisk),
    replayFailureType: normalizeReplayFailureType(payload.replayFailureType),
    latencyMs: Math.max(0, Math.floor(normalizeNumber(payload.latencyMs, 0))),
    costUsd: Math.max(0, normalizeNumber(payload.costUsd, 0)),
    recordEnvelope,
    createdAt: payload.createdAt || serverTimestamp()
  };
  await docRef.set(data, { merge: false });
  return { id: docRef.id, data };
}

async function listLlmQualityLogsByCreatedAtRange(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = Number.isInteger(payload.limit) && payload.limit > 0 ? Math.min(payload.limit, 5000) : 1000;
  const fromAt = toDate(payload.fromAt);
  const toAt = toDate(payload.toAt);
  const db = getDb();
  let query = db.collection(COLLECTION);
  if (fromAt) query = query.where('createdAt', '>=', fromAt);
  if (toAt) query = query.where('createdAt', '<=', toAt);
  const snap = await query.orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  COLLECTION,
  appendLlmQualityLog,
  listLlmQualityLogsByCreatedAtRange
};
