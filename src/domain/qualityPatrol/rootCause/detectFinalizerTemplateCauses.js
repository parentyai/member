'use strict';

const { ROOT_CAUSE_TYPE, REPETITION_METRICS } = require('./constants');

function duplicateValue(values) {
  const seen = new Set();
  for (const item of Array.isArray(values) ? values : []) {
    if (!item) continue;
    if (seen.has(item)) return item;
    seen.add(item);
  }
  return null;
}

function detectFinalizerTemplateCauses(context) {
  const issue = context && context.issue ? context.issue : {};
  const runtimeSignals = context && context.runtimeSignals ? context.runtimeSignals : {};
  const traceSummary = context && context.traceSummary ? context.traceSummary : {};
  const repeatedFinalizer = duplicateValue(runtimeSignals.finalizerTemplateKinds.concat(traceSummary.finalizerTemplateKinds || []));
  const repeatedFingerprint = duplicateValue(runtimeSignals.replyTemplateFingerprints.concat(traceSummary.replyTemplateFingerprints || []));
  const relevant = REPETITION_METRICS.includes(issue.metricKey)
    || issue.issueType === 'fallback_repetition'
    || issue.category === 'repeated_template_response';

  if (!relevant && !runtimeSignals.repeatRiskHigh && !repeatedFinalizer && !repeatedFingerprint) return [];

  return [{
    causeType: ROOT_CAUSE_TYPE.finalizerTemplateCollapse,
    supportingSignals: [
      runtimeSignals.repeatRiskHigh ? 'repeat_risk_high' : null,
      repeatedFinalizer ? `finalizer_template:${repeatedFinalizer}` : null,
      repeatedFingerprint ? 'reply_template_fingerprint_repeated' : null
    ].filter(Boolean),
    supportingEvidence: (Array.isArray(context.supportingEvidence) ? context.supportingEvidence : []).slice(0, 3),
    evidenceGaps: context.evidenceGaps,
    upstreamLayer: 'runtime_telemetry',
    downstreamImpact: [issue.category || issue.metricKey].filter(Boolean)
  }];
}

module.exports = {
  detectFinalizerTemplateCauses
};
