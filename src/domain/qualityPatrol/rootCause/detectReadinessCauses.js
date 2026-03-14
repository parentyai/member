'use strict';

const { ROOT_CAUSE_TYPE } = require('./constants');

function detectReadinessCauses(context) {
  const runtimeSignals = context && context.runtimeSignals ? context.runtimeSignals : {};
  const issue = context && context.issue ? context.issue : {};
  const readinessDecisions = Array.isArray(runtimeSignals.readinessDecisions) ? runtimeSignals.readinessDecisions : [];
  const rejected = readinessDecisions.filter((item) => ['clarify', 'hedged', 'refuse'].includes(item));
  if (!rejected.length) return [];

  return [{
    causeType: ROOT_CAUSE_TYPE.readinessRejection,
    supportingSignals: rejected.slice(0, 2).map((item) => `readiness_${item}`),
    supportingEvidence: (Array.isArray(context.supportingEvidence) ? context.supportingEvidence : []).filter((item) => item.signal === 'readinessDecision').slice(0, 2),
    evidenceGaps: context.evidenceGaps,
    upstreamLayer: 'runtime_telemetry',
    downstreamImpact: [issue.metricKey, issue.category].filter(Boolean)
  }];
}

module.exports = {
  detectReadinessCauses
};
