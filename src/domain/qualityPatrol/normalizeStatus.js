'use strict';

const {
  normalizeIssueStatus,
  normalizeIssueSeverity,
  clampConfidence,
  extractSampleCount
} = require('./issueModel');

function normalizeStatus(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const explicit = normalizeIssueStatus(payload.status);
  const severity = normalizeIssueSeverity(payload.severity) || 'medium';
  const confidence = clampConfidence(payload.confidence, 0.5);
  const sampleCount = extractSampleCount(payload);

  if (explicit === 'mitigated' || explicit === 'closed') return explicit;
  if (explicit === 'watching') return 'watching';
  if (confidence < 0.45) return 'watching';
  if (sampleCount > 0 && sampleCount < 2) return 'watching';
  if (severity === 'low' && payload.observationBlocker !== true) return 'watching';
  return 'open';
}

module.exports = {
  normalizeStatus
};
