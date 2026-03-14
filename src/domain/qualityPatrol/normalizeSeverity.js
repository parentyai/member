'use strict';

const {
  normalizeIssueSeverity,
  normalizeIssueCategory,
  normalizeIssueLayer,
  normalizeIssueProvenance,
  clampConfidence,
  extractSampleCount
} = require('./issueModel');

const SEVERITY_RANK = Object.freeze({
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
});

const HIGH_SEVERITY_CATEGORIES = new Set([
  'generic_fallback_repeat',
  'generic_fallback_hardening_needed',
  'answer_too_template_like',
  'followup_reset',
  'followup_context_lost',
  'machine_like_tone',
  'city_specificity_missing',
  'compat_over_reliance'
]);

const MEDIUM_SEVERITY_CATEGORIES = new Set([
  'observation_blocked',
  'transcript_observation_blocked',
  'missing_transcript_availability',
  'low_procedural_utility',
  'housing_answer_lacks_grounding',
  'trace_join_incomplete'
]);

function pickHigherSeverity(left, right) {
  const a = normalizeIssueSeverity(left) || 'low';
  const b = normalizeIssueSeverity(right) || 'low';
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

function normalizeSeverity(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const explicit = normalizeIssueSeverity(payload.severity);
  const layer = normalizeIssueLayer(payload.layer);
  const category = normalizeIssueCategory(payload.category);
  const provenance = normalizeIssueProvenance(payload.provenance);
  const confidence = clampConfidence(payload.confidence, 0.5);
  const sampleCount = extractSampleCount(payload);
  let resolved = explicit || 'medium';

  if (payload.observationBlocker === true) {
    resolved = pickHigherSeverity(resolved, provenance === 'live' ? 'high' : 'medium');
  }
  if (HIGH_SEVERITY_CATEGORIES.has(category)) {
    resolved = pickHigherSeverity(resolved, 'high');
  }
  if (layer === 'conversation' && category === 'generic_fallback_repeat') {
    resolved = pickHigherSeverity(resolved, 'high');
  }
  if (MEDIUM_SEVERITY_CATEGORIES.has(category)) {
    resolved = pickHigherSeverity(resolved, 'medium');
  }
  if (confidence < 0.35 && payload.observationBlocker !== true && !HIGH_SEVERITY_CATEGORIES.has(category)) {
    resolved = 'low';
  }
  if (sampleCount > 0 && sampleCount < 2 && confidence < 0.5 && payload.observationBlocker !== true) {
    resolved = 'low';
  }

  return resolved;
}

module.exports = {
  SEVERITY_RANK,
  HIGH_SEVERITY_CATEGORIES,
  MEDIUM_SEVERITY_CATEGORIES,
  pickHigherSeverity,
  normalizeSeverity
};
