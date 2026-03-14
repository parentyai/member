'use strict';

const { groupBySlice } = require('./groupBySlice');
const { mergeObservationBlockers } = require('./mergeObservationBlockers');
const { resolveMetricStatus } = require('./resolveMetricStatus');
const { buildMetricEnvelope } = require('./buildMetricEnvelope');
const { KPI_PROVENANCE } = require('./constants');

function hasIssueCandidate(row, code) {
  return Array.isArray(row && row.issueCandidates) && row.issueCandidates.some((item) => item && item.code === code);
}

function aggregateRows(rows, issueCode, threshold, isApplicable) {
  const source = Array.isArray(rows) ? rows : [];
  const applicable = typeof isApplicable === 'function' ? isApplicable : () => true;
  let sampleCount = 0;
  let missingCount = 0;
  let falseCount = 0;
  let blockedCount = 0;
  let unavailableCount = 0;
  let positiveCount = 0;
  const blockers = [];
  const sourceCollections = new Set();

  source.forEach((row) => {
    if (!applicable(row)) return;
    (Array.isArray(row && row.sourceCollections) ? row.sourceCollections : []).forEach((item) => sourceCollections.add(item));
    if (row && row.status === 'blocked') {
      blockedCount += 1;
      blockers.push({ blockers: row && row.observationBlockers, slice: row && row.slice });
      return;
    }
    sampleCount += 1;
    if (hasIssueCandidate(row, issueCode)) {
      positiveCount += 1;
    } else {
      falseCount += 1;
    }
  });

  const value = sampleCount > 0 ? Math.round((positiveCount / sampleCount) * 10000) / 10000 : 0;
  return {
    value,
    sampleCount,
    missingCount,
    falseCount,
    blockedCount,
    unavailableCount,
    status: resolveMetricStatus({ value, sampleCount, missingCount, blockedCount, unavailableCount, threshold }),
    sourceCollections: Array.from(sourceCollections).sort((left, right) => left.localeCompare(right, 'ja')),
    observationBlockers: mergeObservationBlockers(blockers)
  };
}

function aggregateIssueCandidateMetric(evaluations, issueCode, threshold, isApplicable) {
  const rows = Array.isArray(evaluations) ? evaluations : [];
  const grouped = groupBySlice(rows, (row) => row && row.slice);
  const overall = aggregateRows(rows, issueCode, threshold, isApplicable);
  const bySlice = {};
  grouped.forEach((sliceRows, slice) => {
    bySlice[slice] = aggregateRows(sliceRows, issueCode, threshold, isApplicable);
  });
  return buildMetricEnvelope(Object.assign({}, overall, {
    provenance: KPI_PROVENANCE,
    bySlice
  }));
}

module.exports = {
  aggregateIssueCandidateMetric
};
