'use strict';

const {
  FIXED_ROOT_CAUSE_BY_METRIC,
  FIXED_ROOT_CAUSE_BY_CATEGORY,
  FIXED_ROOT_CAUSE_BY_ISSUE_CODE
} = require('./constants');

function normalizeIssueCode(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
}

function detectFixedRootCauseCauses(context) {
  const payload = context && typeof context === 'object' ? context : {};
  const issue = payload.issue && typeof payload.issue === 'object' ? payload.issue : {};
  const metricKey = typeof issue.metricKey === 'string' ? issue.metricKey : '';
  const category = typeof issue.category === 'string' ? issue.category : '';
  const issueCode = normalizeIssueCode(issue.issueCode);
  const mappedCauseType = (issueCode && FIXED_ROOT_CAUSE_BY_ISSUE_CODE[issueCode])
    || (metricKey && FIXED_ROOT_CAUSE_BY_METRIC[metricKey])
    || (category && FIXED_ROOT_CAUSE_BY_CATEGORY[category])
    || null;

  if (!mappedCauseType) return [];

  return [{
    causeType: mappedCauseType,
    supportingSignals: [
      'fixed_root_cause_mapping_applied',
      issueCode ? `issue_code:${issueCode}` : null,
      metricKey ? `metric:${metricKey}` : null,
      category ? `category:${category}` : null
    ].filter(Boolean),
    supportingEvidence: (Array.isArray(payload.supportingEvidence) ? payload.supportingEvidence : []).slice(0, 4),
    evidenceGaps: Array.isArray(payload.evidenceGaps) ? payload.evidenceGaps : [],
    upstreamLayer: 'fixed_root_cause_map',
    downstreamImpact: [category || metricKey].filter(Boolean)
  }];
}

module.exports = {
  detectFixedRootCauseCauses
};
