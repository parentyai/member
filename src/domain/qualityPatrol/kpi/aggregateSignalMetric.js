'use strict';

const { groupBySlice } = require('./groupBySlice');
const { mergeObservationBlockers } = require('./mergeObservationBlockers');
const { resolveMetricStatus } = require('./resolveMetricStatus');
const { buildMetricEnvelope } = require('./buildMetricEnvelope');
const { KPI_PROVENANCE } = require('./constants');

function normalizeValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return Math.round(numeric * 10000) / 10000;
}

function aggregateRows(rows, signalKey, threshold) {
  const source = Array.isArray(rows) ? rows : [];
  let sampleCount = 0;
  let missingCount = 0;
  let falseCount = 0;
  let blockedCount = 0;
  let unavailableCount = 0;
  let totalValue = 0;
  const blockers = [];
  const sourceCollections = new Set();

  source.forEach((row) => {
    (Array.isArray(row && row.sourceCollections) ? row.sourceCollections : []).forEach((item) => sourceCollections.add(item));
    const signal = row && row.signals ? row.signals[signalKey] : null;
    if (!signal || typeof signal !== 'object') {
      missingCount += 1;
      return;
    }
    const status = typeof signal.status === 'string' ? signal.status : 'unavailable';
    if (status === 'blocked') {
      blockedCount += 1;
      blockers.push({ blockers: row && row.observationBlockers, slice: row && row.slice });
      return;
    }
    if (status === 'unavailable') {
      unavailableCount += 1;
      return;
    }
    sampleCount += 1;
    totalValue += normalizeValue(signal.value);
    if (status === 'fail') falseCount += 1;
  });

  const value = sampleCount > 0 ? Math.round((totalValue / sampleCount) * 10000) / 10000 : 0;
  let status = resolveMetricStatus({ value, sampleCount, missingCount, blockedCount, unavailableCount, threshold });
  if (falseCount > 0) {
    if (status === 'pass') status = 'warn';
    else if (status === 'warn') status = 'fail';
  }
  return {
    value,
    sampleCount,
    missingCount,
    falseCount,
    blockedCount,
    unavailableCount,
    status,
    sourceCollections: Array.from(sourceCollections).sort((left, right) => left.localeCompare(right, 'ja')),
    observationBlockers: mergeObservationBlockers(blockers)
  };
}

function aggregateSignalMetric(evaluations, signalKey, threshold) {
  const rows = Array.isArray(evaluations) ? evaluations : [];
  const grouped = groupBySlice(rows, (row) => row && row.slice);
  const overall = aggregateRows(rows, signalKey, threshold);
  const bySlice = {};
  grouped.forEach((sliceRows, slice) => {
    bySlice[slice] = aggregateRows(sliceRows, signalKey, threshold);
  });
  return buildMetricEnvelope(Object.assign({}, overall, {
    provenance: KPI_PROVENANCE,
    bySlice
  }));
}

module.exports = {
  aggregateSignalMetric
};
