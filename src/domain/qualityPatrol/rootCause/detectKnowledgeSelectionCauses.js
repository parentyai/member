'use strict';

const { ROOT_CAUSE_TYPE, KNOWLEDGE_METRICS } = require('./constants');

function detectKnowledgeSelectionCauses(context) {
  const issue = context && context.issue ? context.issue : {};
  const runtimeSignals = context && context.runtimeSignals ? context.runtimeSignals : {};
  const traceSummary = context && context.traceSummary ? context.traceSummary : {};
  const relevant = KNOWLEDGE_METRICS.includes(issue.metricKey)
    || issue.issueType === 'knowledge_activation'
    || issue.category === 'knowledge_activation_missing'
    || issue.category === 'saved_faq_unused'
    || issue.category === 'city_pack_unused';
  if (!relevant) return [];

  const available = runtimeSignals.groundedCandidateAvailable === true
    || runtimeSignals.cityPackCandidateAvailable === true
    || runtimeSignals.savedFaqCandidateAvailable === true;
  const used = runtimeSignals.knowledgeCandidateUsed === true
    || runtimeSignals.cityPackUsedInAnswer === true
    || runtimeSignals.savedFaqUsedInAnswer === true;
  const selectedFallback = runtimeSignals.selectedCandidateKinds.some((item) => /fallback|concierge|generic/.test(item))
    || runtimeSignals.fallbackTemplateKinds.some((item) => /fallback|generic/.test(item));
  const out = [];

  if (!available) {
    out.push({
      causeType: ROOT_CAUSE_TYPE.knowledgeCandidateMissing,
      supportingSignals: ['knowledge_candidate_not_available'].concat(Array.isArray(traceSummary.knowledgeRejectedReasons) ? traceSummary.knowledgeRejectedReasons.slice(0, 2) : []),
      supportingEvidence: (Array.isArray(context.supportingEvidence) ? context.supportingEvidence : []).slice(0, 3),
      evidenceGaps: context.evidenceGaps,
      upstreamLayer: 'runtime_telemetry',
      downstreamImpact: [issue.category || issue.metricKey].filter(Boolean)
    });
  }

  if (available && !used) {
    out.push({
      causeType: ROOT_CAUSE_TYPE.knowledgeCandidateUnused,
      supportingSignals: ['knowledge_available_but_unused'],
      supportingEvidence: (Array.isArray(context.supportingEvidence) ? context.supportingEvidence : []).slice(0, 3),
      evidenceGaps: context.evidenceGaps,
      upstreamLayer: 'runtime_telemetry',
      downstreamImpact: [issue.category || issue.metricKey].filter(Boolean)
    });
  }

  if (available && !used && selectedFallback) {
    out.push({
      causeType: ROOT_CAUSE_TYPE.fallbackSelectedOverGrounded,
      supportingSignals: ['fallback_selected_over_grounded'],
      supportingEvidence: (Array.isArray(context.supportingEvidence) ? context.supportingEvidence : []).slice(0, 3),
      evidenceGaps: context.evidenceGaps,
      upstreamLayer: 'runtime_telemetry',
      downstreamImpact: ['fallback_repetition', issue.category || issue.metricKey].filter(Boolean)
    });
  }

  return out;
}

module.exports = {
  detectKnowledgeSelectionCauses
};
