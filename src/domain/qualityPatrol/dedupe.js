'use strict';

const { normalizeSeverity, pickHigherSeverity } = require('./normalizeSeverity');
const { normalizeStatus } = require('./normalizeStatus');
const {
  clampConfidence,
  normalizeIssueLayer,
  normalizeIssueCategory,
  normalizeIssueSlice,
  normalizeIssueProvenance,
  normalizeThreadId,
  normalizeSummary,
  normalizeRootCauseHint,
  normalizeTraceRefs,
  normalizeSupportingEvidence,
  normalizeStringList,
  normalizeRelatedMetrics
} = require('./issueModel');

const PROVENANCE_RANK = Object.freeze({
  unavailable: 0,
  prepared_summary: 1,
  historical: 2,
  live: 3
});

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
  }
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
}

function earliestIso(left, right) {
  const leftMs = toMillis(left);
  const rightMs = toMillis(right);
  if (!leftMs) return right || left || null;
  if (!rightMs) return left || right || null;
  return leftMs <= rightMs ? left : right;
}

function latestIso(left, right) {
  const leftMs = toMillis(left);
  const rightMs = toMillis(right);
  if (!leftMs) return right || left || null;
  if (!rightMs) return left || right || null;
  return leftMs >= rightMs ? left : right;
}

function mergeStructuredRows(existing, incoming, limit) {
  const rows = [];
  const seen = new Set();
  []
    .concat(Array.isArray(existing) ? existing : [])
    .concat(Array.isArray(incoming) ? incoming : [])
    .forEach((item) => {
      if (rows.length >= limit) return;
      const key = JSON.stringify(item);
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(item);
    });
  return rows;
}

function pickPreferredProvenance(left, right) {
  const a = normalizeIssueProvenance(left);
  const b = normalizeIssueProvenance(right);
  return (PROVENANCE_RANK[a] || 0) >= (PROVENANCE_RANK[b] || 0) ? a : b;
}

function mergeIssueRecords(existing, incoming) {
  const current = existing && typeof existing === 'object' ? existing : {};
  const next = incoming && typeof incoming === 'object' ? incoming : {};
  const currentOccurrence = Number.isFinite(Number(current.occurrenceCount))
    ? Math.max(1, Math.floor(Number(current.occurrenceCount)))
    : 1;
  const nextOccurrence = Number.isFinite(Number(next.occurrenceCount))
    ? Math.max(1, Math.floor(Number(next.occurrenceCount)))
    : 1;
  const mergedConfidence = Math.max(clampConfidence(current.confidence, 0), clampConfidence(next.confidence, 0));
  const mergedEvidence = mergeStructuredRows(
    normalizeSupportingEvidence(current.supportingEvidence),
    normalizeSupportingEvidence(next.supportingEvidence),
    12
  );
  const mergedMetrics = mergeStructuredRows(
    normalizeRelatedMetrics(current.relatedMetrics),
    normalizeRelatedMetrics(next.relatedMetrics),
    12
  );
  const mergedSourceCollections = normalizeStringList(
    []
      .concat(Array.isArray(current.sourceCollections) ? current.sourceCollections : [])
      .concat(Array.isArray(next.sourceCollections) ? next.sourceCollections : []),
    { limit: 8, transform: 'token' }
  );
  const mergedRootCauseHint = normalizeRootCauseHint(
    []
      .concat(Array.isArray(current.rootCauseHint) ? current.rootCauseHint : [])
      .concat(Array.isArray(next.rootCauseHint) ? next.rootCauseHint : [])
  );
  const mergedTraceRefs = normalizeTraceRefs(
    []
      .concat(Array.isArray(current.traceRefs) ? current.traceRefs : [])
      .concat(Array.isArray(next.traceRefs) ? next.traceRefs : [])
  );
  const observationBlocker = current.observationBlocker === true || next.observationBlocker === true;
  const severity = normalizeSeverity({
    severity: pickHigherSeverity(current.severity, next.severity),
    layer: next.layer || current.layer,
    category: next.category || current.category,
    provenance: pickPreferredProvenance(current.provenance, next.provenance),
    observationBlocker,
    confidence: mergedConfidence,
    relatedMetrics: mergedMetrics
  });
  const occurrenceCount = currentOccurrence + nextOccurrence;
  const status = normalizeStatus({
    status: next.status || current.status,
    severity,
    confidence: mergedConfidence,
    observationBlocker,
    occurrenceCount,
    relatedMetrics: mergedMetrics
  });

  return {
    issueId: next.issueId || current.issueId,
    issueFingerprint: next.issueFingerprint || current.issueFingerprint,
    detectedAt: next.detectedAt || current.detectedAt || null,
    updatedAt: next.updatedAt || next.detectedAt || current.updatedAt || current.lastSeenAt || null,
    threadId: normalizeThreadId(next.threadId || current.threadId),
    layer: normalizeIssueLayer(next.layer || current.layer),
    category: normalizeIssueCategory(next.category || current.category),
    slice: normalizeIssueSlice(next.slice || current.slice),
    severity,
    status,
    provenance: pickPreferredProvenance(current.provenance, next.provenance),
    observationBlocker,
    confidence: mergedConfidence,
    supportingEvidence: mergedEvidence,
    traceRefs: mergedTraceRefs,
    sourceCollections: mergedSourceCollections,
    firstSeenAt: earliestIso(current.firstSeenAt || current.detectedAt, next.firstSeenAt || next.detectedAt),
    lastSeenAt: latestIso(current.lastSeenAt || current.detectedAt, next.lastSeenAt || next.detectedAt || next.updatedAt),
    occurrenceCount,
    latestSummary: normalizeSummary(next.latestSummary, current.latestSummary),
    rootCauseHint: mergedRootCauseHint,
    relatedMetrics: mergedMetrics
  };
}

module.exports = {
  mergeIssueRecords,
  pickPreferredProvenance
};
