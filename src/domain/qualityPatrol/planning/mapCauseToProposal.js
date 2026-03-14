'use strict';

const { detectObservationFirstPlan } = require('./detectObservationFirstPlan');
const { detectKnowledgeFixPlan } = require('./detectKnowledgeFixPlan');
const { detectContinuityFixPlan } = require('./detectContinuityFixPlan');
const { detectTemplateFixPlan } = require('./detectTemplateFixPlan');
const { detectRuntimeFixPlan } = require('./detectRuntimeFixPlan');

function mapCauseToProposal(report, cause) {
  return detectObservationFirstPlan(report, cause)
    || detectKnowledgeFixPlan(report, cause)
    || detectContinuityFixPlan(report, cause)
    || detectTemplateFixPlan(report, cause)
    || detectRuntimeFixPlan(report, cause)
    || null;
}

module.exports = {
  mapCauseToProposal
};
