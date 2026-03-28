'use strict';

const { ROOT_CAUSE_TYPE } = require('../rootCause/constants');
const { PROPOSAL_TEMPLATE_BY_CAUSE } = require('./constants');

const RUNTIME_CAUSES = new Set([
  ROOT_CAUSE_TYPE.intentCompression,
  ROOT_CAUSE_TYPE.clarifyOverselection,
  ROOT_CAUSE_TYPE.detailBlindGeneration,
  ROOT_CAUSE_TYPE.commandBoundaryMisfire,
  ROOT_CAUSE_TYPE.readinessRejection,
  ROOT_CAUSE_TYPE.citySpecificityGap,
  ROOT_CAUSE_TYPE.specificityResolutionGap,
  ROOT_CAUSE_TYPE.sourceTransformDrop,
  ROOT_CAUSE_TYPE.deepenPlannerReset,
  ROOT_CAUSE_TYPE.regionCommandCollision,
  ROOT_CAUSE_TYPE.proceduralGuidanceGap,
  ROOT_CAUSE_TYPE.retrievalBlocked
]);

function detectRuntimeFixPlan(_report, cause) {
  if (!cause || !RUNTIME_CAUSES.has(cause.causeType)) return null;
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
  detectRuntimeFixPlan
};
