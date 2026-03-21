'use strict';

const {
  ROOT_CAUSE_TYPE,
  CONCIERGE_ISSUE_CODES,
  CONCIERGE_ISSUE_CAUSE_TYPES,
  CONCIERGE_ISSUE_LABELS
} = require('./constants');

function normalizedIssueCode(issue) {
  const payload = issue && typeof issue === 'object' ? issue : {};
  const candidates = [payload.category, payload.metricKey];
  for (let i = 0; i < candidates.length; i += 1) {
    const value = typeof candidates[i] === 'string' ? candidates[i].trim() : '';
    if (value && CONCIERGE_ISSUE_CODES.includes(value)) return value;
  }
  return '';
}

function detectConciergeCauses(context) {
  const issue = context && context.issue ? context.issue : {};
  const code = normalizedIssueCode(issue);
  if (!code) return [];
  if (code === 'trace_join_incomplete') return [];

  const causeType = CONCIERGE_ISSUE_CAUSE_TYPES[code] || ROOT_CAUSE_TYPE.readinessRejection;
  const runtimeSignals = context && context.runtimeSignals ? context.runtimeSignals : {};
  const supportingSignals = [code];

  if (code === 'saved_faq_high_risk_reuse' && runtimeSignals.savedFaqUsedInAnswer === true) {
    supportingSignals.push('saved_faq_used_in_answer');
  }
  if (code === 'stale_city_pack_required_source' && runtimeSignals.cityPackCandidateAvailable === true) {
    supportingSignals.push('city_pack_candidate_available');
  }
  if (code === 'trace_join_incomplete' && runtimeSignals.retrievalBlockedByStrategy === true) {
    supportingSignals.push('trace_join_limited_by_strategy');
  }
  if (code === 'direct_url_leakage' && runtimeSignals.directUrlLeakage === true) {
    supportingSignals.push('direct_url_leakage_observed');
  }
  if (code === 'official_source_missing_on_high_risk' && runtimeSignals.officialOnlySatisfiedRate != null) {
    supportingSignals.push('official_source_required');
  }

  return [{
    causeType,
    supportingSignals,
    supportingEvidence: (Array.isArray(context.supportingEvidence) ? context.supportingEvidence : []).slice(0, 3),
    evidenceGaps: Array.isArray(context.evidenceGaps) ? context.evidenceGaps : [],
    upstreamLayer: code === 'trace_join_incomplete' ? 'detection' : 'runtime_telemetry',
    downstreamImpact: [issue.category || issue.metricKey].filter(Boolean),
    label: CONCIERGE_ISSUE_LABELS[code] || code
  }];
}

module.exports = {
  detectConciergeCauses
};
