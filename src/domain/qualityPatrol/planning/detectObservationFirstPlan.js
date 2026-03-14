'use strict';

const { ROOT_CAUSE_TYPE } = require('../rootCause/constants');
const { PROPOSAL_TYPE, PROPOSAL_TEMPLATE_BY_CAUSE } = require('./constants');

const OBSERVATION_CAUSES = new Set([
  ROOT_CAUSE_TYPE.observationGap,
  ROOT_CAUSE_TYPE.transcriptUnavailable,
  ROOT_CAUSE_TYPE.reviewUnitBlocked,
  ROOT_CAUSE_TYPE.evidenceInsufficient,
  ROOT_CAUSE_TYPE.observationOnlyNoRuntimeInference,
  ROOT_CAUSE_TYPE.blockedByMissingContext,
  ROOT_CAUSE_TYPE.blockedByUnavailableData
]);

function detectObservationFirstPlan(report, cause) {
  if (!report || !cause || !OBSERVATION_CAUSES.has(cause.causeType)) return null;
  const template = PROPOSAL_TEMPLATE_BY_CAUSE[cause.causeType] || PROPOSAL_TEMPLATE_BY_CAUSE[ROOT_CAUSE_TYPE.observationGap];
  return {
    proposalType: template.proposalType || PROPOSAL_TYPE.observationOnly,
    title: template.title,
    objective: template.objective,
    whyNotOthers: template.whyNotOthers,
    planningStatus: report.analysisStatus === 'blocked' ? 'blocked' : 'insufficient_evidence'
  };
}

module.exports = {
  detectObservationFirstPlan
};
