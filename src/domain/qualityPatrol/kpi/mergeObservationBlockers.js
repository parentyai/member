'use strict';

const { normalizeSlice } = require('./groupBySlice');

const SEVERITY_WEIGHT = Object.freeze({
  low: 1,
  medium: 2,
  high: 3
});

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function mergeObservationBlockers(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const acc = new Map();

  source.forEach((row) => {
    const blockers = Array.isArray(row && row.blockers) ? row.blockers : [];
    const slice = normalizeSlice(row && row.slice);
    blockers.forEach((blocker) => {
      const code = normalizeText(blocker && blocker.code);
      if (!code) return;
      if (!acc.has(code)) {
        acc.set(code, {
          code,
          severity: normalizeText(blocker && blocker.severity) || 'low',
          message: normalizeText(blocker && blocker.message) || null,
          sources: new Set(),
          slices: new Set(),
          count: 0
        });
      }
      const item = acc.get(code);
      item.count += 1;
      const incomingSeverity = normalizeText(blocker && blocker.severity) || 'low';
      if ((SEVERITY_WEIGHT[incomingSeverity] || 0) > (SEVERITY_WEIGHT[item.severity] || 0)) {
        item.severity = incomingSeverity;
      }
      const sourceValue = normalizeText(blocker && blocker.source);
      if (sourceValue) item.sources.add(sourceValue);
      if (slice) item.slices.add(slice);
    });
  });

  return Array.from(acc.values())
    .map((item) => ({
      code: item.code,
      severity: item.severity,
      message: item.message,
      count: item.count,
      source: Array.from(item.sources)[0] || null,
      sources: Array.from(item.sources).sort((left, right) => left.localeCompare(right, 'ja')),
      slices: Array.from(item.slices).sort((left, right) => left.localeCompare(right, 'ja'))
    }))
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code, 'ja'));
}

module.exports = {
  mergeObservationBlockers
};
