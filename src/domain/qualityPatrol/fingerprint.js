'use strict';

const crypto = require('node:crypto');
const {
  normalizeIssueLayer,
  normalizeIssueCategory,
  normalizeIssueSlice,
  normalizeRootCauseHint,
  normalizeSupportingEvidence,
  normalizeRelatedMetrics,
  normalizeToken
} = require('./issueModel');

function extractSignalToken(item) {
  if (!item || typeof item !== 'object') return '';
  return normalizeToken(
    item.signal
    || item.metric
    || item.collection
    || item.status
    || item.summary,
    ''
  ) || '';
}

function resolveTopSupportingSignal(payload) {
  const evidenceTokens = normalizeSupportingEvidence(payload && payload.supportingEvidence)
    .map((item) => extractSignalToken(item))
    .filter(Boolean);
  const metricTokens = normalizeRelatedMetrics(payload && payload.relatedMetrics)
    .map((item) => normalizeToken(item.metric, ''))
    .filter(Boolean);
  const tokens = Array.from(new Set(evidenceTokens.concat(metricTokens))).sort((a, b) => a.localeCompare(b));
  return tokens[0] || 'no_signal';
}

function buildIssueFingerprint(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const layer = normalizeIssueLayer(payload.layer);
  const category = normalizeIssueCategory(payload.category);
  const slice = normalizeIssueSlice(payload.slice);
  const rootCause = normalizeRootCauseHint(payload.rootCauseHint)[0] || 'no_root_cause';
  const signal = resolveTopSupportingSignal(payload);
  return ['quality_issue_v1', layer, category, slice, rootCause, signal].join('|');
}

function buildIssueIdFromFingerprint(fingerprint) {
  const source = typeof fingerprint === 'string' ? fingerprint : '';
  const digest = crypto.createHash('sha256').update(source, 'utf8').digest('hex').slice(0, 24);
  return `qi_${digest}`;
}

module.exports = {
  buildIssueFingerprint,
  buildIssueIdFromFingerprint,
  resolveTopSupportingSignal
};
