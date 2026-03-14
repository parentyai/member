'use strict';

const { PROPOSAL_PRIORITY, PROPOSAL_TYPE } = require('./constants');

function resolvePlanningPriority(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const proposalType = payload.proposalType;
  const confidence = payload.confidence || 'medium';
  const analysisStatus = payload.analysisStatus || 'planned';

  if ([PROPOSAL_TYPE.blockedByObservationGap, PROPOSAL_TYPE.transcriptCoverageRepair].includes(proposalType)) {
    return PROPOSAL_PRIORITY.P1;
  }
  if ([PROPOSAL_TYPE.sampleCollection, PROPOSAL_TYPE.observationOnly].includes(proposalType)) {
    return analysisStatus === 'blocked' ? PROPOSAL_PRIORITY.P1 : PROPOSAL_PRIORITY.P2;
  }
  if ([PROPOSAL_TYPE.noActionUntilEvidence].includes(proposalType)) {
    return PROPOSAL_PRIORITY.P3;
  }
  if ([PROPOSAL_TYPE.knowledgeFix, PROPOSAL_TYPE.readinessFix, PROPOSAL_TYPE.templateFix, PROPOSAL_TYPE.continuityFix, PROPOSAL_TYPE.specificityFix, PROPOSAL_TYPE.retrievalFix].includes(proposalType)) {
    if (confidence === 'high') return PROPOSAL_PRIORITY.P1;
    return PROPOSAL_PRIORITY.P2;
  }
  if (proposalType === PROPOSAL_TYPE.runtimeFix) {
    return confidence === 'high' ? PROPOSAL_PRIORITY.P1 : PROPOSAL_PRIORITY.P2;
  }
  return PROPOSAL_PRIORITY.P2;
}

module.exports = {
  resolvePlanningPriority
};
