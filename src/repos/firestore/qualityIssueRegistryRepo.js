'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');
const { assertRecordEnvelopeCompliance } = require('../../domain/data/universalRecordEnvelopeCompliance');
const { sortByTimestampDesc } = require('./queryFallback');
const { mergeIssueRecords } = require('../../domain/qualityPatrol/dedupe');
const {
  normalizeText,
  normalizeIssueLayer,
  normalizeIssueCategory,
  normalizeIssueSlice,
  normalizeIssueSeverity,
  normalizeIssueStatus,
  normalizeIssueProvenance,
  clampConfidence,
  normalizeSupportingEvidence,
  normalizeTraceRefs,
  normalizeStringList,
  normalizeRootCauseHint,
  normalizeRelatedMetrics,
  normalizeSummary
} = require('../../domain/qualityPatrol/issueModel');

const COLLECTION = 'quality_issue_registry';

function resolveTimestamp(value) {
  return value || serverTimestamp();
}

function normalizeIssueRow(payload, recordEnvelope, createdAt, updatedAt) {
  const source = payload && typeof payload === 'object' ? payload : {};
  return {
    issueId: normalizeText(source.issueId),
    issueFingerprint: normalizeText(source.issueFingerprint),
    detectedAt: resolveTimestamp(source.detectedAt || createdAt),
    updatedAt: resolveTimestamp(updatedAt || source.updatedAt || source.lastSeenAt || source.detectedAt || createdAt),
    threadId: normalizeText(source.threadId) || 'unknown',
    layer: normalizeIssueLayer(source.layer),
    category: normalizeIssueCategory(source.category),
    slice: normalizeIssueSlice(source.slice),
    severity: normalizeIssueSeverity(source.severity) || 'medium',
    status: normalizeIssueStatus(source.status) || 'open',
    provenance: normalizeIssueProvenance(source.provenance),
    observationBlocker: source.observationBlocker === true,
    confidence: clampConfidence(source.confidence, 0.5),
    supportingEvidence: normalizeSupportingEvidence(source.supportingEvidence),
    traceRefs: normalizeTraceRefs(source.traceRefs),
    sourceCollections: normalizeStringList(source.sourceCollections, { limit: 8, transform: 'token' }),
    firstSeenAt: resolveTimestamp(source.firstSeenAt || source.detectedAt || createdAt),
    lastSeenAt: resolveTimestamp(source.lastSeenAt || source.detectedAt || updatedAt || createdAt),
    occurrenceCount: Number.isFinite(Number(source.occurrenceCount))
      ? Math.max(1, Math.floor(Number(source.occurrenceCount)))
      : 1,
    latestSummary: normalizeSummary(source.latestSummary, source.category),
    rootCauseHint: normalizeRootCauseHint(source.rootCauseHint),
    relatedMetrics: normalizeRelatedMetrics(source.relatedMetrics),
    recordEnvelope
  };
}

function buildRecordEnvelope(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const createdAt = payload.createdAt || new Date().toISOString();
  return buildUniversalRecordEnvelope({
    recordId: payload.issueId,
    recordType: 'quality_issue_record',
    sourceSystem: 'member_firestore',
    sourceSnapshotRef: 'snapshot:quality_issue_registry',
    effectiveFrom: createdAt,
    authorityTier: 'T2_PUBLIC_DATA',
    bindingLevel: 'RECOMMENDED',
    status: 'active',
    retentionTag: 'quality_issue_registry_indefinite',
    piiClass: 'none',
    accessScope: ['operator', 'quality_patrol'],
    maskingPolicy: 'quality_patrol_registry_structured_v1',
    deletionPolicy: 'retention_policy_v1',
    createdAt,
    updatedAt: payload.updatedAt || createdAt
  });
}

async function getQualityIssue(issueId) {
  if (!issueId) throw new Error('issueId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(issueId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function upsertQualityIssue(data) {
  const payload = data && typeof data === 'object' ? data : {};
  if (!normalizeText(payload.issueId)) throw new Error('issueId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(payload.issueId);
  const result = { id: payload.issueId, created: false, issueFingerprint: payload.issueFingerprint || null, occurrenceCount: 0 };

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) {
      const recordEnvelope = buildRecordEnvelope({
        issueId: payload.issueId,
        createdAt: payload.firstSeenAt || payload.detectedAt || new Date().toISOString(),
        updatedAt: payload.updatedAt || payload.detectedAt || new Date().toISOString()
      });
      assertRecordEnvelopeCompliance({ dataClass: 'quality_issue_registry', recordEnvelope });
      const row = normalizeIssueRow(
        payload,
        recordEnvelope,
        payload.firstSeenAt || payload.detectedAt || new Date().toISOString(),
        payload.updatedAt || payload.detectedAt || new Date().toISOString()
      );
      tx.set(docRef, row, { merge: false });
      result.created = true;
      result.issueFingerprint = row.issueFingerprint;
      result.occurrenceCount = row.occurrenceCount;
      return;
    }

    const existing = Object.assign({ id: snap.id }, snap.data());
    const merged = mergeIssueRecords(existing, payload);
    const recordEnvelope = buildRecordEnvelope({
      issueId: merged.issueId,
      createdAt: existing.recordEnvelope && existing.recordEnvelope.created_at
        ? existing.recordEnvelope.created_at
        : (merged.firstSeenAt || new Date().toISOString()),
      updatedAt: merged.updatedAt || new Date().toISOString()
    });
    assertRecordEnvelopeCompliance({ dataClass: 'quality_issue_registry', recordEnvelope });
    const row = normalizeIssueRow(
      merged,
      recordEnvelope,
      merged.firstSeenAt || existing.firstSeenAt || merged.detectedAt || new Date().toISOString(),
      merged.updatedAt || new Date().toISOString()
    );
    tx.set(docRef, row, { merge: true });
    result.created = false;
    result.issueFingerprint = row.issueFingerprint;
    result.occurrenceCount = row.occurrenceCount;
  });

  return result;
}

async function listQualityIssues(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(payload.limit)) ? Math.min(Math.max(Math.floor(Number(payload.limit)), 1), 200) : 50;
  const scanLimit = Math.min(Math.max(limit * 3, limit), 300);
  const statusFilter = normalizeStringList(payload.statuses || (payload.status ? [payload.status] : []), { limit: 6, transform: 'token' });
  const layerFilter = normalizeText(payload.layer) ? normalizeIssueLayer(payload.layer) : null;
  const sliceFilter = normalizeText(payload.slice) ? normalizeIssueSlice(payload.slice) : null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).limit(scanLimit).get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  sortByTimestampDesc(rows, 'updatedAt');

  return rows
    .filter((row) => !statusFilter.length || statusFilter.includes(normalizeIssueStatus(row && row.status) || 'open'))
    .filter((row) => !layerFilter || normalizeIssueLayer(row && row.layer) === layerFilter)
    .filter((row) => !sliceFilter || normalizeIssueSlice(row && row.slice) === sliceFilter)
    .slice(0, limit);
}

module.exports = {
  COLLECTION,
  getQualityIssue,
  upsertQualityIssue,
  listQualityIssues
};
