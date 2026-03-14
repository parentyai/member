'use strict';

const { KPI_PROVENANCE, KPI_SLICES } = require('./constants');

function normalizeCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return Math.round(numeric * 10000) / 10000;
}

function buildSliceEnvelope(slice, data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    slice,
    value: clamp01(payload.value),
    sampleCount: normalizeCount(payload.sampleCount),
    missingCount: normalizeCount(payload.missingCount),
    falseCount: normalizeCount(payload.falseCount),
    blockedCount: normalizeCount(payload.blockedCount),
    unavailableCount: normalizeCount(payload.unavailableCount),
    status: typeof payload.status === 'string' ? payload.status : 'unavailable'
  };
}

function buildMetricEnvelope(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const bySlicePayload = payload.bySlice && typeof payload.bySlice === 'object' ? payload.bySlice : {};
  return {
    value: clamp01(payload.value),
    sampleCount: normalizeCount(payload.sampleCount),
    missingCount: normalizeCount(payload.missingCount),
    falseCount: normalizeCount(payload.falseCount),
    blockedCount: normalizeCount(payload.blockedCount),
    unavailableCount: normalizeCount(payload.unavailableCount),
    status: typeof payload.status === 'string' ? payload.status : 'unavailable',
    provenance: typeof payload.provenance === 'string' && payload.provenance.trim()
      ? payload.provenance.trim()
      : KPI_PROVENANCE,
    sourceCollections: Array.isArray(payload.sourceCollections) ? Array.from(new Set(payload.sourceCollections.filter(Boolean))) : [],
    observationBlockers: Array.isArray(payload.observationBlockers) ? payload.observationBlockers.slice() : [],
    bySlice: KPI_SLICES.map((slice) => buildSliceEnvelope(slice, bySlicePayload[slice] || { status: 'unavailable' }))
  };
}

module.exports = {
  buildMetricEnvelope
};
