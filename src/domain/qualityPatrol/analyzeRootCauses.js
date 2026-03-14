'use strict';

const { buildRootCauseReport } = require('./rootCause/buildRootCauseReport');
const { ROOT_CAUSE_PROVENANCE } = require('./rootCause/constants');

function mergeSourceCollections() {
  const out = [];
  Array.from(arguments).forEach((input) => {
    (Array.isArray(input) ? input : []).forEach((item) => {
      if (typeof item === 'string' && item.trim()) out.push(item.trim());
    });
  });
  return Array.from(new Set(out)).sort((left, right) => left.localeCompare(right, 'ja'));
}

function buildSummary(reports) {
  const byAnalysisStatus = {};
  const byCauseType = {};
  let blockedCount = 0;
  let analyzedCount = 0;
  let insufficientEvidenceCount = 0;
  (Array.isArray(reports) ? reports : []).forEach((report) => {
    const status = report && report.analysisStatus ? report.analysisStatus : 'insufficient_evidence';
    byAnalysisStatus[status] = (byAnalysisStatus[status] || 0) + 1;
    if (status === 'blocked') blockedCount += 1;
    else if (status === 'analyzed') analyzedCount += 1;
    else insufficientEvidenceCount += 1;
    (Array.isArray(report && report.causeCandidates) ? report.causeCandidates : []).forEach((candidate) => {
      if (!candidate || !candidate.causeType) return;
      byCauseType[candidate.causeType] = (byCauseType[candidate.causeType] || 0) + 1;
    });
  });
  return {
    reportCount: Array.isArray(reports) ? reports.length : 0,
    analyzedCount,
    blockedCount,
    insufficientEvidenceCount,
    byAnalysisStatus,
    byCauseType
  };
}

function analyzeRootCauses(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const detectionResult = payload.detectionResult && typeof payload.detectionResult === 'object' ? payload.detectionResult : {};
  const issues = Array.isArray(detectionResult.issueCandidates) ? detectionResult.issueCandidates : [];
  const reports = issues.map((issue) => buildRootCauseReport({
    issue,
    kpiResult: payload.kpiResult,
    evaluations: payload.evaluations,
    reviewUnits: payload.reviewUnits,
    traceBundles: payload.traceBundles
  }));
  return {
    summary: buildSummary(reports),
    rootCauseReports: reports,
    provenance: ROOT_CAUSE_PROVENANCE,
    sourceCollections: mergeSourceCollections(
      detectionResult.sourceCollections,
      reports.flatMap((item) => Array.isArray(item && item.sourceCollections) ? item.sourceCollections : [])
    )
  };
}

module.exports = {
  analyzeRootCauses
};
