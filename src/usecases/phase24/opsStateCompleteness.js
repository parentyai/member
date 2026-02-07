'use strict';

function evaluateOpsStateCompleteness(opsState) {
  if (!opsState) {
    return { status: 'WARN', missing: ['missing_ops_state'] };
  }
  if (!opsState.nextAction || typeof opsState.nextAction !== 'string' || opsState.nextAction.trim().length === 0) {
    return { status: 'WARN', missing: ['missing_next_action'] };
  }
  return { status: 'OK', missing: [] };
}

module.exports = {
  evaluateOpsStateCompleteness
};
