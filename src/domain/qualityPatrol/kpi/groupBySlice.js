'use strict';

const { KPI_SLICES } = require('./constants');

function normalizeSlice(value) {
  if (typeof value !== 'string') return 'other';
  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'followup') return 'follow-up';
  return KPI_SLICES.includes(trimmed) ? trimmed : 'other';
}

function groupBySlice(rows, getSlice) {
  const source = Array.isArray(rows) ? rows : [];
  const resolver = typeof getSlice === 'function' ? getSlice : (row) => row && row.slice;
  const groups = new Map(KPI_SLICES.map((slice) => [slice, []]));
  source.forEach((row) => {
    const slice = normalizeSlice(resolver(row));
    groups.get(slice).push(row);
  });
  return groups;
}

module.exports = {
  KPI_SLICES,
  normalizeSlice,
  groupBySlice
};
