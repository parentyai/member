'use strict';

const { ROOT_CAUSE_TYPE, CITY_SPECIFICITY_METRICS, PROCEDURAL_METRICS } = require('./constants');

function detectSpecificityCauses(context) {
  const issue = context && context.issue ? context.issue : {};
  const runtimeSignals = context && context.runtimeSignals ? context.runtimeSignals : {};
  const out = [];

  if ((issue.slice === 'city'
      || issue.category === 'city_specificity_missing'
      || issue.category === 'city_scope_overclaim'
      || CITY_SPECIFICITY_METRICS.includes(issue.metricKey)
      || issue.metricKey === 'cityOverclaimRate')
    && (runtimeSignals.cityPackCandidateAvailable === true
      || runtimeSignals.knowledgeGroundingKinds.includes('city')
      || runtimeSignals.knowledgeGroundingKinds.includes('city_pack')
      || runtimeSignals.citySpecificitySatisfied === false)) {
    out.push({
      causeType: issue.category === 'city_scope_overclaim'
        ? ROOT_CAUSE_TYPE.specificityResolutionGap
        : ROOT_CAUSE_TYPE.citySpecificityGap,
      supportingSignals: [
        'city_specificity_gap',
        runtimeSignals.cityPackCandidateAvailable === true && runtimeSignals.cityPackUsedInAnswer !== true ? 'city_pack_available_but_unused' : null,
        runtimeSignals.citySpecificitySatisfied === false ? 'city_specificity_not_satisfied' : null
      ].filter(Boolean),
      supportingEvidence: (Array.isArray(context.supportingEvidence) ? context.supportingEvidence : []).slice(0, 3),
      evidenceGaps: context.evidenceGaps,
      upstreamLayer: 'runtime_telemetry',
      downstreamImpact: [issue.category || issue.metricKey].filter(Boolean)
    });
  }

  if ((issue.slice === 'broad' || issue.slice === 'housing' || issue.category === 'next_step_missing' || PROCEDURAL_METRICS.includes(issue.metricKey))
    && (!Array.isArray(runtimeSignals.committedNextActions) || runtimeSignals.committedNextActions.length === 0)) {
    out.push({
      causeType: ROOT_CAUSE_TYPE.proceduralGuidanceGap,
      supportingSignals: ['procedural_guidance_gap'],
      supportingEvidence: (Array.isArray(context.supportingEvidence) ? context.supportingEvidence : []).slice(0, 3),
      evidenceGaps: context.evidenceGaps,
      upstreamLayer: 'evaluator',
      downstreamImpact: [issue.category || issue.metricKey].filter(Boolean)
    });
  }

  return out;
}

module.exports = {
  detectSpecificityCauses
};
