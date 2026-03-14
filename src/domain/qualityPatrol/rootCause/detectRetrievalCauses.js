'use strict';

const { ROOT_CAUSE_TYPE } = require('./constants');

function detectRetrievalCauses(context) {
  const runtimeSignals = context && context.runtimeSignals ? context.runtimeSignals : {};
  const traceSummary = context && context.traceSummary ? context.traceSummary : {};
  const issue = context && context.issue ? context.issue : {};
  const supportingEvidence = (Array.isArray(context && context.supportingEvidence) ? context.supportingEvidence : []).filter((item) => item.signal === 'selectedCandidateKind').slice(0, 2);

  if (runtimeSignals.retrievalBlockedByStrategy !== true && (!Array.isArray(traceSummary.retrievalBlockReasons) || traceSummary.retrievalBlockReasons.length === 0)) {
    return [];
  }

  return [{
    causeType: ROOT_CAUSE_TYPE.retrievalBlocked,
    supportingSignals: ['retrieval_blocked_by_strategy'].concat(Array.isArray(traceSummary.retrievalBlockReasons) ? traceSummary.retrievalBlockReasons.slice(0, 2) : []),
    supportingEvidence,
    evidenceGaps: context.evidenceGaps,
    upstreamLayer: 'runtime_telemetry',
    downstreamImpact: [issue.metricKey, issue.category].filter(Boolean)
  }];
}

module.exports = {
  detectRetrievalCauses
};
