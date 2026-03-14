'use strict';

const { ROOT_CAUSE_TYPE } = require('../rootCause/constants');
const { PROPOSAL_TEMPLATE_BY_CAUSE } = require('./constants');

const KNOWLEDGE_CAUSES = new Set([
  ROOT_CAUSE_TYPE.knowledgeCandidateMissing,
  ROOT_CAUSE_TYPE.knowledgeCandidateUnused,
  ROOT_CAUSE_TYPE.fallbackSelectedOverGrounded
]);

function detectKnowledgeFixPlan(_report, cause) {
  if (!cause || !KNOWLEDGE_CAUSES.has(cause.causeType)) return null;
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
  detectKnowledgeFixPlan
};
