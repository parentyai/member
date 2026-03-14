'use strict';

const { resolveAudienceView } = require('./resolveAudienceView');

function pushRow(rows, seen, traceId, reason, availability) {
  const normalizedTraceId = typeof traceId === 'string' ? traceId.trim() : '';
  const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
  const normalizedAvailability = availability === 'missing' ? 'missing' : 'available';
  if (!normalizedTraceId && normalizedAvailability !== 'missing') return;
  const key = JSON.stringify([normalizedTraceId, normalizedReason, normalizedAvailability]);
  if (seen.has(key)) return;
  seen.add(key);
  rows.push({
    traceId: normalizedTraceId || '',
    reason: normalizedReason || 'trace evidence',
    availability: normalizedAvailability
  });
}

function buildTraceRefs(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const audience = resolveAudienceView(payload.audience);
  if (audience === 'human') return [];

  const rows = [];
  const seen = new Set();
  const limit = Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.min(20, Math.floor(Number(payload.limit)))) : 8;

  (Array.isArray(payload.reviewUnits) ? payload.reviewUnits : []).forEach((unit) => {
    (Array.isArray(unit && unit.evidenceRefs) ? unit.evidenceRefs : []).forEach((ref) => {
      pushRow(
        rows,
        seen,
        ref && ref.traceId,
        `review_unit:${unit && unit.slice ? unit.slice : 'other'}`,
        ref && ref.traceId ? 'available' : 'missing'
      );
    });
  });

  (Array.isArray(payload.rootCauseReports) ? payload.rootCauseReports : []).forEach((report) => {
    (Array.isArray(report && report.causeCandidates) ? report.causeCandidates : []).forEach((candidate) => {
      (Array.isArray(candidate && candidate.supportingEvidence) ? candidate.supportingEvidence : []).forEach((evidence) => {
        pushRow(
          rows,
          seen,
          evidence && evidence.traceId,
          report && report.issueKey ? `root_cause:${report.issueKey}` : 'root_cause',
          evidence && evidence.traceId ? 'available' : 'missing'
        );
      });
    });
  });

  (Array.isArray(payload.issues) ? payload.issues : []).forEach((issue) => {
    (Array.isArray(issue && issue.supportingEvidence) ? issue.supportingEvidence : []).forEach((evidence) => {
      pushRow(
        rows,
        seen,
        evidence && (evidence.traceId || evidence.traceRef),
        issue && issue.issueKey ? `issue:${issue.issueKey}` : 'issue',
        evidence && (evidence.traceId || evidence.traceRef) ? 'available' : 'missing'
      );
    });
  });

  return rows.slice(0, limit);
}

module.exports = {
  buildTraceRefs
};
