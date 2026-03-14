'use strict';

const { DETECTION_PROVENANCE } = require('./detection/constants');
const { detectMetricIssues } = require('./detection/detectMetricIssues');
const { detectObservationBlockers } = require('./detection/detectObservationBlockers');
const { detectSliceIssues } = require('./detection/detectSliceIssues');

function mergeSourceCollections(values) {
  const out = [];
  (Array.isArray(values) ? values : []).forEach((item) => {
    if (Array.isArray(item)) {
      item.forEach((nested) => {
        if (typeof nested === 'string' && nested.trim()) out.push(nested.trim());
      });
      return;
    }
    if (typeof item === 'string' && item.trim()) out.push(item.trim());
  });
  return Array.from(new Set(out)).sort((left, right) => left.localeCompare(right, 'ja'));
}

function candidateFingerprint(candidate) {
  const source = candidate && typeof candidate === 'object' ? candidate : {};
  return JSON.stringify({
    issueType: source.issueType,
    metricKey: source.metricKey,
    slice: source.slice,
    category: source.category,
    scope: source.fingerprintInput && source.fingerprintInput.scope,
    signals: Array.isArray(source.supportingSignals) ? source.supportingSignals : []
  });
}

function dedupeIssues(candidates) {
  const out = [];
  const seen = new Set();
  (Array.isArray(candidates) ? candidates : []).forEach((item) => {
    const key = candidateFingerprint(item);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

function buildBacklogCandidates(issues) {
  const grouped = new Map();
  (Array.isArray(issues) ? issues : []).forEach((issue) => {
    const backlog = issue && issue.recommendedBacklog ? issue.recommendedBacklog : null;
    if (!backlog) return;
    const key = JSON.stringify([backlog.title, backlog.priority, backlog.objective]);
    if (!grouped.has(key)) {
      grouped.set(key, Object.assign({}, backlog, {
        issueKeys: []
      }));
    }
    grouped.get(key).issueKeys.push(issue.issueKey);
  });
  return Array.from(grouped.values()).map((item) => Object.assign({}, item, {
    issueKeys: Array.from(new Set(item.issueKeys)).sort((left, right) => left.localeCompare(right, 'ja'))
  }));
}

function buildSummary(issues) {
  const source = Array.isArray(issues) ? issues : [];
  const byType = {};
  const bySlice = {};
  let blockedCount = 0;
  let openCount = 0;
  let watchingCount = 0;
  source.forEach((item) => {
    byType[item.issueType] = (byType[item.issueType] || 0) + 1;
    bySlice[item.slice] = (bySlice[item.slice] || 0) + 1;
    if (item.status === 'blocked') blockedCount += 1;
    else if (item.status === 'open') openCount += 1;
    else if (item.status === 'watching') watchingCount += 1;
  });
  return {
    issueCount: source.length,
    blockedCount,
    openCount,
    watchingCount,
    byType,
    bySlice
  };
}

function detectIssues(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const kpiResult = payload.kpiResult && typeof payload.kpiResult === 'object' ? payload.kpiResult : {};
  const sourceCollections = mergeSourceCollections([
    kpiResult.sourceCollections,
    Object.values(kpiResult.metrics || {}).map((row) => row && row.sourceCollections),
    Object.values(kpiResult.issueCandidateMetrics || {}).map((row) => row && row.sourceCollections)
  ]);
  const issues = dedupeIssues([]
    .concat(detectObservationBlockers(kpiResult))
    .concat(detectMetricIssues(kpiResult))
    .concat(detectSliceIssues(kpiResult)));
  return {
    summary: buildSummary(issues),
    issueCandidates: issues,
    backlogCandidates: buildBacklogCandidates(issues),
    provenance: DETECTION_PROVENANCE,
    sourceCollections
  };
}

module.exports = {
  detectIssues
};
