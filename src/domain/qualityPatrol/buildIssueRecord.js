'use strict';

const { buildIssueFingerprint, buildIssueIdFromFingerprint } = require('./fingerprint');
const { normalizeSeverity } = require('./normalizeSeverity');
const { normalizeStatus } = require('./normalizeStatus');
const {
  normalizeThreadId,
  normalizeIssueLayer,
  normalizeIssueCategory,
  normalizeIssueSlice,
  normalizeIssueProvenance,
  clampConfidence,
  normalizeSummary,
  normalizeRootCauseHint,
  normalizeTraceRefs,
  normalizeSupportingEvidence,
  normalizeStringList,
  normalizeRelatedMetrics
} = require('./issueModel');

function toIso(value, fallback) {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return fallback;
}

function buildIssueRecord(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const nowIso = new Date().toISOString();
  const detectedAt = toIso(payload.detectedAt, nowIso);
  const updatedAt = toIso(payload.updatedAt, detectedAt);
  const supportingEvidence = normalizeSupportingEvidence(payload.supportingEvidence);
  const relatedMetrics = normalizeRelatedMetrics(payload.relatedMetrics);
  const sourceCollections = normalizeStringList(payload.sourceCollections, { limit: 8, transform: 'token' });
  const rootCauseHint = normalizeRootCauseHint(payload.rootCauseHint);
  const issueFingerprint = buildIssueFingerprint({
    layer: payload.layer,
    category: payload.category,
    slice: payload.slice,
    rootCauseHint,
    supportingEvidence,
    relatedMetrics
  });
  const issueId = payload.issueId || buildIssueIdFromFingerprint(issueFingerprint);
  const confidence = clampConfidence(payload.confidence, 0.5);
  const observationBlocker = payload.observationBlocker === true;
  const severity = normalizeSeverity({
    severity: payload.severity,
    layer: payload.layer,
    category: payload.category,
    provenance: payload.provenance,
    observationBlocker,
    confidence,
    relatedMetrics
  });
  const status = normalizeStatus({
    status: payload.status,
    severity,
    confidence,
    observationBlocker,
    relatedMetrics
  });

  return {
    issueId,
    issueFingerprint,
    detectedAt,
    updatedAt,
    threadId: normalizeThreadId(payload.threadId),
    layer: normalizeIssueLayer(payload.layer),
    category: normalizeIssueCategory(payload.category),
    slice: normalizeIssueSlice(payload.slice),
    severity,
    status,
    provenance: normalizeIssueProvenance(payload.provenance),
    observationBlocker,
    confidence,
    supportingEvidence,
    traceRefs: normalizeTraceRefs(payload.traceRefs),
    sourceCollections,
    firstSeenAt: toIso(payload.firstSeenAt, detectedAt),
    lastSeenAt: toIso(payload.lastSeenAt, detectedAt),
    occurrenceCount: Number.isFinite(Number(payload.occurrenceCount))
      ? Math.max(1, Math.floor(Number(payload.occurrenceCount)))
      : 1,
    latestSummary: normalizeSummary(payload.latestSummary || payload.summary, payload.category),
    rootCauseHint,
    relatedMetrics
  };
}

module.exports = {
  buildIssueRecord
};
