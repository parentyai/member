'use strict';

const { ROOT_CAUSE_TYPE, CONTINUITY_METRICS, CONTEXT_BLOCKER_CODES } = require('./constants');

function detectContinuityCauses(context) {
  const issue = context && context.issue ? context.issue : {};
  const runtimeSignals = context && context.runtimeSignals ? context.runtimeSignals : {};
  const blockers = Array.isArray(context && context.observationBlockers) ? context.observationBlockers : [];
  const blockerCodes = new Set(blockers.map((item) => item && item.code).filter(Boolean));
  const relevant = issue.slice === 'follow-up'
    || CONTINUITY_METRICS.includes(issue.metricKey)
    || issue.category === 'followup_context_reset';
  if (!relevant) return [];

  if (runtimeSignals.priorContextUsed === true && runtimeSignals.followupResolvedFromHistory === true) return [];

  return [{
    causeType: ROOT_CAUSE_TYPE.followupContextLoss,
    supportingSignals: [
      runtimeSignals.priorContextUsed === true ? null : 'prior_context_not_used',
      runtimeSignals.followupResolvedFromHistory === true ? null : 'followup_not_resolved_from_history',
      Array.from(blockerCodes).some((item) => CONTEXT_BLOCKER_CODES.includes(item)) ? 'missing_followup_context' : null
    ].filter(Boolean),
    supportingEvidence: (Array.isArray(context.supportingEvidence) ? context.supportingEvidence : []).slice(0, 3),
    evidenceGaps: context.evidenceGaps,
    upstreamLayer: 'runtime_telemetry',
    downstreamImpact: [issue.category || issue.metricKey].filter(Boolean)
  }];
}

module.exports = {
  detectContinuityCauses
};
