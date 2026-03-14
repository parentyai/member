'use strict';

const { BLOCKER_CATALOG } = require('./constants');

function createBlocker(code) {
  const base = BLOCKER_CATALOG[code];
  if (!base) return null;
  return {
    code,
    severity: base.severity,
    message: base.message,
    source: base.source
  };
}

function buildObservationBlockers(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const blockers = [];

  if (payload.userMessageAvailable !== true) blockers.push(createBlocker('missing_user_message'));
  if (payload.assistantReplyAvailable !== true) blockers.push(createBlocker('missing_assistant_reply'));
  if (payload.needsPriorContextSummary === true && payload.priorContextSummaryAvailable !== true) {
    blockers.push(createBlocker('missing_prior_context_summary'));
  }
  if (payload.hasActionLogEvidence !== true) blockers.push(createBlocker('missing_action_log_evidence'));
  if (payload.expectsFaqEvidence === true && payload.hasFaqEvidence !== true) blockers.push(createBlocker('missing_faq_evidence'));
  if (payload.hasTraceEvidence !== true) blockers.push(createBlocker('missing_trace_evidence'));
  if (payload.userMessageAvailable !== true || payload.assistantReplyAvailable !== true) {
    blockers.push(createBlocker('transcript_not_reviewable'));
  }

  return blockers.filter(Boolean).filter((item, index, rows) =>
    rows.findIndex((other) => other && other.code === item.code) === index
  );
}

module.exports = {
  buildObservationBlockers
};
