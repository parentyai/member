'use strict';

const { PROPOSAL_TYPE } = require('./constants');

function resolveRollbackPlan(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const proposalType = payload.proposalType;

  if ([PROPOSAL_TYPE.observationOnly, PROPOSAL_TYPE.sampleCollection, PROPOSAL_TYPE.transcriptCoverageRepair, PROPOSAL_TYPE.noActionUntilEvidence, PROPOSAL_TYPE.blockedByObservationGap].includes(proposalType)) {
    return [
      'Stop the new observation-only caller or job before changing any runtime path.',
      'Revert the observation docs/runbook follow-up PR if it creates noisy operator guidance.'
    ];
  }

  return [
    'Gate the future runtime repair behind an explicit feature flag or manual caller before rollout.',
    'Revert the future runtime-fix PR and restore previous selection/readiness/finalizer behavior if regressions appear.'
  ];
}

module.exports = {
  resolveRollbackPlan
};
