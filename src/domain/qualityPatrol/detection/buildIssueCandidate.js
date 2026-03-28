'use strict';

const crypto = require('node:crypto');
const {
  DETECTION_PROVENANCE,
  ISSUE_TYPE_BY_METRIC,
  CATEGORY_BY_METRIC,
  ISSUE_CODE_BY_METRIC,
  TITLE_BY_METRIC,
  METRIC_THRESHOLDS
} = require('./constants');
const { resolveDetectionSeverity } = require('./resolveDetectionSeverity');
const { resolveDetectionStatus } = require('./resolveDetectionStatus');
const { resolveDetectionConfidence } = require('./resolveDetectionConfidence');
const { buildBacklogCandidate } = require('./buildBacklogCandidate');

function toThresholdShape(threshold) {
  const source = threshold && typeof threshold === 'object' ? threshold : {};
  if (source.direction === 'lower') {
    return {
      warn: Number.isFinite(Number(source.passMax)) ? Number(source.passMax) : null,
      fail: Number.isFinite(Number(source.warnMax)) ? Number(source.warnMax) : null,
      blocked: 1
    };
  }
  return {
    warn: Number.isFinite(Number(source.passMin)) ? Number(source.passMin) : null,
    fail: Number.isFinite(Number(source.warnMin)) ? Number(source.warnMin) : null,
    blocked: 1
  };
}

function normalizeSignals(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ja'));
}

function normalizeEvidence(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  const seen = new Set();
  rows.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const normalized = {};
    if (item.metricKey) normalized.metric = item.metricKey;
    if (item.metricStatus) normalized.status = item.metricStatus;
    if (item.summary) normalized.summary = String(item.summary);
    if (item.slice) normalized.slice = item.slice;
    if (item.value !== undefined) normalized.value = item.value;
    if (item.sampleCount !== undefined) normalized.sampleCount = item.sampleCount;
    if (item.code) normalized.signal = item.code;
    if (!Object.keys(normalized).length) return;
    const key = JSON.stringify(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
}

function buildIssueKey(seed) {
  return `qpd_${crypto.createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 20)}`;
}

function normalizeIssueCode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
  return normalized || null;
}

function defaultIssueCode(metricKey) {
  if (!metricKey) return null;
  if (Object.prototype.hasOwnProperty.call(ISSUE_CODE_BY_METRIC, metricKey)) {
    return ISSUE_CODE_BY_METRIC[metricKey];
  }
  const normalizedMetric = String(metricKey)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .toUpperCase();
  return normalizedMetric ? `QP_${normalizedMetric}` : null;
}

function buildIssueCandidate(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const metricKey = payload.metricKey;
  const issueType = payload.issueType || ISSUE_TYPE_BY_METRIC[metricKey] || 'conversation_quality';
  const category = payload.category || CATEGORY_BY_METRIC[metricKey] || metricKey;
  const slice = payload.slice || 'global';
  const metricStatus = payload.metricStatus || 'unavailable';
  const severity = payload.severity || resolveDetectionSeverity({
    issueType,
    metricKey,
    metricStatus,
    slice,
    value: payload.value
  });
  const resolvedStatus = payload.status || resolveDetectionStatus({
    metricStatus,
    missingCount: payload.missingCount
  });
  const status = payload.historicalOnly === true && resolvedStatus === 'open'
    ? 'watching'
    : resolvedStatus;
  const confidence = payload.confidence || resolveDetectionConfidence({
    metricStatus,
    sampleCount: payload.sampleCount,
    value: payload.value,
    blockedCount: payload.blockedCount
  });
  const fingerprintInput = Object.assign({
    layer: payload.layer || (issueType === 'observation_blocker' ? 'observation' : 'conversation'),
    category,
    slice,
    scope: payload.scope || (slice === 'global' ? 'global' : 'slice'),
    metricKey
  }, payload.fingerprintInput || {});
  const title = payload.title || TITLE_BY_METRIC[metricKey] || category;
  const summary = payload.summary || `${title} (${slice})`;
  const thresholds = payload.thresholds || toThresholdShape(METRIC_THRESHOLDS[metricKey]);
  const issueCode = normalizeIssueCode(payload.issueCode) || defaultIssueCode(metricKey);
  const supportingSignals = normalizeSignals(payload.supportingSignals);
  const supportingEvidence = normalizeEvidence(payload.supportingEvidence);
  const sourceCollections = Array.from(new Set((Array.isArray(payload.sourceCollections) ? payload.sourceCollections : []).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ja'));
  const observationBlockers = Array.isArray(payload.observationBlockers) ? payload.observationBlockers.slice() : [];
  const issueKey = payload.issueKey || buildIssueKey([
    issueCode || 'NO_CODE',
    issueType,
    category,
    metricKey,
    slice,
    fingerprintInput.scope || 'scope_unknown',
    supportingSignals.join('|')
  ].join('|'));

  return {
    issueType,
    issueKey,
    issueCode,
    title,
    summary,
    severity,
    status,
    confidence,
    metricKey,
    metricStatus,
    layer: payload.layer || fingerprintInput.layer,
    category,
    slice,
    provenance: DETECTION_PROVENANCE,
    sourceCollections,
    observationBlockers,
    historicalOnly: payload.historicalOnly === true,
    supportingSignals,
    supportingEvidence,
    thresholds,
    fingerprintInput,
    recommendedBacklog: buildBacklogCandidate({
      metricKey,
      parentMetricKey: payload.parentMetricKey
    })
  };
}

module.exports = {
  buildIssueCandidate
};
