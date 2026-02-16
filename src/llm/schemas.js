'use strict';

const OPS_EXPLANATION_SCHEMA_ID = 'OpsExplanation.v1';
const NEXT_ACTION_CANDIDATES_SCHEMA_ID = 'NextActionCandidates.v1';
const FAQ_ANSWER_SCHEMA_ID = 'FAQAnswer.v1';

const ABSTRACT_ACTIONS = Object.freeze([
  'MONITOR',
  'REVIEW',
  'ESCALATE',
  'DEFER',
  'NO_ACTION'
]);

module.exports = {
  OPS_EXPLANATION_SCHEMA_ID,
  NEXT_ACTION_CANDIDATES_SCHEMA_ID,
  FAQ_ANSWER_SCHEMA_ID,
  ABSTRACT_ACTIONS
};
