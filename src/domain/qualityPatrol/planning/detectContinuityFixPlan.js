'use strict';

const { ROOT_CAUSE_TYPE } = require('../rootCause/constants');
const { PROPOSAL_TEMPLATE_BY_CAUSE } = require('./constants');

function detectContinuityFixPlan(_report, cause) {
  if (!cause || cause.causeType !== ROOT_CAUSE_TYPE.followupContextLoss) return null;
  const template = PROPOSAL_TEMPLATE_BY_CAUSE[cause.causeType];
  return {
    proposalType: template.proposalType,
    title: template.title,
    objective: template.objective,
    whyNotOthers: template.whyNotOthers,
    planningStatus: 'planned'
  };
}

module.exports = {
  detectContinuityFixPlan
};
