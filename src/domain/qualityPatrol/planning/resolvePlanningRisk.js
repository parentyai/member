'use strict';

const { PROPOSAL_RISK, PROPOSAL_TYPE } = require('./constants');

function resolvePlanningRisk(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const proposalType = payload.proposalType;
  const confidence = payload.confidence || 'medium';
  const blockedByCount = Array.isArray(payload.blockedBy) ? payload.blockedBy.length : 0;

  if ([PROPOSAL_TYPE.noActionUntilEvidence, PROPOSAL_TYPE.observationOnly, PROPOSAL_TYPE.sampleCollection, PROPOSAL_TYPE.transcriptCoverageRepair, PROPOSAL_TYPE.blockedByObservationGap].includes(proposalType)) {
    return PROPOSAL_RISK.low;
  }
  if ([PROPOSAL_TYPE.readinessFix, PROPOSAL_TYPE.templateFix].includes(proposalType)) {
    return confidence === 'low' || blockedByCount > 0 ? PROPOSAL_RISK.high : PROPOSAL_RISK.medium;
  }
  if ([PROPOSAL_TYPE.knowledgeFix, PROPOSAL_TYPE.continuityFix, PROPOSAL_TYPE.specificityFix, PROPOSAL_TYPE.retrievalFix, PROPOSAL_TYPE.runtimeFix].includes(proposalType)) {
    return confidence === 'low' ? PROPOSAL_RISK.high : PROPOSAL_RISK.medium;
  }
  return PROPOSAL_RISK.medium;
}

module.exports = {
  resolvePlanningRisk
};
