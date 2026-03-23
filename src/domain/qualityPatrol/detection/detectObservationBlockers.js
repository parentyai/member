'use strict';

const { AVAILABILITY_METRIC_KEYS, BLOCKER_METRIC_KEYS } = require('./constants');
const { buildIssueCandidate } = require('./buildIssueCandidate');

function isHistoricalOnlyObservationDebt(payload) {
  const readiness = payload && payload.decayAwareReadiness && typeof payload.decayAwareReadiness === 'object'
    ? payload.decayAwareReadiness
    : {};
  const currentRuntimeHealth = readiness.currentRuntimeHealth && typeof readiness.currentRuntimeHealth === 'object'
    ? readiness.currentRuntimeHealth
    : {};
  return readiness.overallReadinessStatus === 'historical_backlog_dominant'
    && currentRuntimeHealth.status === 'healthy';
}

function toRows(metricKey, envelope) {
  const metric = envelope && typeof envelope === 'object' ? envelope : null;
  if (!metric) return [];
  const rows = [];
  if (!(metric.status === 'unavailable' && metric.sampleCount <= 0 && metric.blockedCount <= 0 && metric.unavailableCount <= 0)) {
    rows.push({
      slice: 'global',
      scope: 'global',
      metric
    });
  }
  const bySlice = Array.isArray(metric.bySlice) ? metric.bySlice : [];
  bySlice.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    if (row.status === 'unavailable' && row.sampleCount <= 0 && row.blockedCount <= 0 && row.unavailableCount <= 0) return;
    rows.push({
      slice: row.slice,
      scope: 'slice',
      metric: Object.assign({}, row, {
        observationBlockers: Array.isArray(metric.observationBlockers)
          ? metric.observationBlockers.filter((item) => !Array.isArray(item && item.slices) || item.slices.includes(row.slice))
          : [],
        sourceCollections: metric.sourceCollections
      })
    });
  });
  return rows.map((row) => Object.assign({ metricKey }, row));
}

function buildBlockerSummary(metricKey, metricRow, slice) {
  const status = metricRow && metricRow.status ? metricRow.status : 'unavailable';
  const label = slice === 'global' ? 'global' : slice;
  if (status === 'blocked') return `${metricKey} is blocked for ${label} due to observation blockers`;
  if (status === 'unavailable') return `${metricKey} is unavailable for ${label} due to missing patrol evidence`;
  return `${metricKey} coverage is degraded for ${label}`;
}

function buildSupportingEvidence(metricKey, metricRow, slice) {
  const blockers = Array.isArray(metricRow && metricRow.observationBlockers) ? metricRow.observationBlockers : [];
  return [{
    metricKey,
    metricStatus: metricRow && metricRow.status,
    slice,
    summary: `${metricKey}:${slice}:${metricRow && metricRow.status}:${metricRow && metricRow.value}`,
    value: metricRow && metricRow.value,
    sampleCount: metricRow && metricRow.sampleCount
  }].concat(blockers.map((item) => ({
    code: item && item.code,
    summary: item && item.message,
    slice
  })));
}

function shouldCreateObservationIssue(metricRow) {
  const status = metricRow && metricRow.status;
  if (status === 'blocked' || status === 'unavailable') return true;
  return (Number(metricRow && metricRow.missingCount) > 0 || status === 'warn' || status === 'fail');
}

function detectObservationBlockers(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const metrics = payload.metrics && typeof payload.metrics === 'object' ? payload.metrics : {};
  const historicalOnly = isHistoricalOnlyObservationDebt(payload);
  const issues = [];

  AVAILABILITY_METRIC_KEYS.concat(BLOCKER_METRIC_KEYS).forEach((metricKey) => {
    const envelope = metrics[metricKey];
    toRows(metricKey, envelope).forEach((row) => {
      if (!shouldCreateObservationIssue(row.metric)) return;
      const slice = row.slice || 'global';
      issues.push(buildIssueCandidate({
        issueType: 'observation_blocker',
        layer: 'observation',
        metricKey,
        slice,
        scope: row.scope,
        metricStatus: row.metric.status,
        status: historicalOnly
          ? 'watching'
          : (BLOCKER_METRIC_KEYS.includes(metricKey) ? 'blocked' : undefined),
        value: row.metric.value,
        sampleCount: row.metric.sampleCount,
        missingCount: row.metric.missingCount,
        blockedCount: row.metric.blockedCount,
        summary: buildBlockerSummary(metricKey, row.metric, slice),
        sourceCollections: row.metric.sourceCollections,
        observationBlockers: row.metric.observationBlockers,
        historicalOnly,
        supportingSignals: []
          .concat(row.metric.status === 'blocked' ? ['metric_blocked'] : [])
          .concat(row.metric.status === 'unavailable' ? ['metric_unavailable'] : [])
          .concat(Number(row.metric.missingCount) > 0 ? ['metric_missing_data'] : []),
        supportingEvidence: buildSupportingEvidence(metricKey, row.metric, slice),
        fingerprintInput: {
          layer: 'observation',
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
  detectObservationBlockers
};
