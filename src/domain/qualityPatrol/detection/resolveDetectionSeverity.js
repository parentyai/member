'use strict';

const { DETECTION_SEVERITY } = require('./constants');

function resolveObservationSeverity(metricKey, params) {
  const payload = params && typeof params === 'object' ? params : {};
  const metricStatus = payload.metricStatus;
  const value = Number.isFinite(Number(payload.value)) ? Number(payload.value) : 0;

  if (['reviewableTranscriptRate', 'userMessageAvailableRate', 'assistantReplyAvailableRate', 'transcriptAvailability'].includes(metricKey)) {
    return metricStatus === 'blocked' || value >= 0.4 ? DETECTION_SEVERITY.high : DETECTION_SEVERITY.medium;
  }
  if (metricKey === 'priorContextSummaryAvailableRate') {
    return payload.slice === 'follow-up' || metricStatus === 'blocked'
      ? DETECTION_SEVERITY.high
      : DETECTION_SEVERITY.medium;
  }
  if (['blockedFollowupJudgementRate', 'blockedKnowledgeJudgementRate'].includes(metricKey)) {
    return value >= 0.3 || metricStatus === 'blocked'
      ? DETECTION_SEVERITY.high
      : DETECTION_SEVERITY.medium;
  }
  return DETECTION_SEVERITY.medium;
}

function resolveQualitySeverity(metricKey, params) {
  const payload = params && typeof params === 'object' ? params : {};
  const slice = payload.slice;
  const metricStatus = payload.metricStatus;
  const value = Number.isFinite(Number(payload.value)) ? Number(payload.value) : 0;

  if (metricKey === 'fallbackRepetition' || metricKey === 'repeatedTemplateResponseRate') {
    if (slice === 'follow-up' && (metricStatus === 'fail' || value >= 0.45)) return DETECTION_SEVERITY.high;
    return metricStatus === 'fail' ? DETECTION_SEVERITY.medium : DETECTION_SEVERITY.low;
  }
  if (metricKey === 'specificity' || metricKey === 'citySpecificityMissingRate') {
    if (slice === 'city' && metricStatus === 'fail') return DETECTION_SEVERITY.high;
    return metricStatus === 'fail' ? DETECTION_SEVERITY.medium : DETECTION_SEVERITY.low;
  }
  if (metricKey === 'proceduralUtility' || metricKey === 'nextStepMissingRate' || metricKey === 'broadAbstractEscapeRate') {
    if (slice === 'broad' && metricStatus === 'fail') return DETECTION_SEVERITY.medium;
    return metricStatus === 'fail' ? DETECTION_SEVERITY.medium : DETECTION_SEVERITY.low;
  }
  if (metricKey === 'knowledgeUse' || ['knowledgeActivationMissingRate', 'savedFaqUnusedRate', 'cityPackUnusedRate'].includes(metricKey)) {
    if (slice === 'city' && metricStatus === 'fail') return DETECTION_SEVERITY.high;
    return metricStatus === 'fail' ? DETECTION_SEVERITY.medium : DETECTION_SEVERITY.low;
  }
  if (metricKey === 'continuity' || metricKey === 'followupContextResetRate') {
    if (slice === 'follow-up' && metricStatus === 'fail') return DETECTION_SEVERITY.high;
    return metricStatus === 'fail' ? DETECTION_SEVERITY.medium : DETECTION_SEVERITY.low;
  }
  if (metricKey === 'naturalness') {
    return metricStatus === 'fail' ? DETECTION_SEVERITY.medium : DETECTION_SEVERITY.low;
  }
  return metricStatus === 'fail' ? DETECTION_SEVERITY.medium : DETECTION_SEVERITY.low;
}

function resolveDetectionSeverity(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const metricKey = payload.metricKey;
  const issueType = payload.issueType;
  if (issueType === 'observation_blocker') return resolveObservationSeverity(metricKey, payload);
  return resolveQualitySeverity(metricKey, payload);
}

module.exports = {
  resolveDetectionSeverity
};
