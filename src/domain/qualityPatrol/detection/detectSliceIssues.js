'use strict';

const { ISSUE_RATE_METRIC_KEYS } = require('./constants');
const { buildIssueCandidate } = require('./buildIssueCandidate');

function toRows(metricKey, envelope) {
  const metric = envelope && typeof envelope === 'object' ? envelope : null;
  if (!metric) return [];
  const rows = [{
    slice: 'global',
    scope: 'global',
    metric
  }];
  const bySlice = Array.isArray(metric.bySlice) ? metric.bySlice : [];
  bySlice.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    if (row.sampleCount <= 0 && row.status === 'unavailable') return;
    rows.push({
      slice: row.slice,
      scope: 'slice',
      metric: Object.assign({}, row, {
        sourceCollections: metric.sourceCollections,
        observationBlockers: Array.isArray(metric.observationBlockers)
          ? metric.observationBlockers.filter((item) => !Array.isArray(item && item.slices) || item.slices.includes(row.slice))
          : []
      })
    });
  });
  return rows.map((row) => Object.assign({ metricKey }, row));
}

function buildIssueSummary(metricKey, slice, metricRow) {
  return `${metricKey} is ${metricRow && metricRow.status} for ${slice} (value=${metricRow && metricRow.value}, sample=${metricRow && metricRow.sampleCount})`;
}

function buildEvidence(metricKey, slice, metricRow) {
  return [{
    metricKey,
    metricStatus: metricRow && metricRow.status,
    slice,
    summary: `${metricKey}:${slice}:${metricRow && metricRow.status}:${metricRow && metricRow.value}`,
    value: metricRow && metricRow.value,
    sampleCount: metricRow && metricRow.sampleCount
  }];
}

function detectSliceIssues(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const metrics = payload.issueCandidateMetrics && typeof payload.issueCandidateMetrics === 'object'
    ? payload.issueCandidateMetrics
    : {};
  const issues = [];

  ISSUE_RATE_METRIC_KEYS.forEach((metricKey) => {
    const envelope = metrics[metricKey];
    toRows(metricKey, envelope).forEach((row) => {
      if (!row.metric || !['warn', 'fail'].includes(row.metric.status)) return;
      const slice = row.slice || 'global';
      issues.push(buildIssueCandidate({
        metricKey,
        slice,
        scope: row.scope,
        metricStatus: row.metric.status,
        value: row.metric.value,
        sampleCount: row.metric.sampleCount,
        missingCount: row.metric.missingCount,
        blockedCount: row.metric.blockedCount,
        summary: buildIssueSummary(metricKey, slice, row.metric),
        sourceCollections: row.metric.sourceCollections,
        observationBlockers: row.metric.observationBlockers,
        supportingSignals: []
          .concat(row.metric.falseCount > 0 ? ['issue_candidate_rate_false_count_present'] : []),
        supportingEvidence: buildEvidence(metricKey, slice, row.metric),
        fingerprintInput: {
          layer: ['knowledgeActivationMissingRate', 'savedFaqUnusedRate', 'cityPackUnusedRate'].includes(metricKey) ? 'telemetry' : 'conversation',
          category: metricKey,
          slice,
          scope: row.scope,
          rootCauseHint: row.scope === 'global' ? 'scope_global' : `scope_${slice}`
        }
      }));
    });
  });

  return issues;
}

module.exports = {
  detectSliceIssues
};
