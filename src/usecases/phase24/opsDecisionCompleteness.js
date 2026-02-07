'use strict';

const decisionLogsRepo = require('../../repos/firestore/decisionLogsRepo');

async function evaluateOpsDecisionCompleteness(opsState, deps) {
  if (!opsState) {
    return { status: 'WARN', missing: ['missing_ops_state'] };
  }

  const decisionLogId = opsState.sourceDecisionLogId;
  if (!decisionLogId) {
    return { status: 'WARN', missing: ['missing_decision_log'] };
  }

  const decisionLogs = deps && deps.decisionLogsRepo ? deps.decisionLogsRepo : decisionLogsRepo;
  const decisionLog = await decisionLogs.getDecisionById(decisionLogId);
  if (!decisionLog || !decisionLog.nextAction) {
    return { status: 'WARN', missing: ['missing_decision_log'] };
  }

  if (opsState.nextAction && decisionLog.nextAction !== opsState.nextAction) {
    return { status: 'WARN', missing: ['mismatched_next_action'] };
  }

  return { status: 'OK', missing: [] };
}

module.exports = {
  evaluateOpsDecisionCompleteness
};
