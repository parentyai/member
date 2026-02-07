'use strict';

function pushMissing(blocking, label, missing) {
  for (const code of missing) {
    blocking.push(`${label}:${code}`);
  }
}

function collectBlocking(blocking, label, completeness) {
  if (!completeness) {
    blocking.push(`missing_${label}`);
    return;
  }

  const missing = Array.isArray(completeness.missing) ? completeness.missing : [];
  if (missing.length > 0) {
    pushMissing(blocking, label, missing);
    return;
  }

  if (typeof completeness.status === 'string' && completeness.status !== 'OK') {
    blocking.push(`${label}:not_ok`);
    return;
  }

  if (typeof completeness.ok === 'boolean' && completeness.ok === false) {
    blocking.push(`${label}:not_ok`);
  }
}

function evaluateOverallDecisionReadiness(inputs) {
  const payload = inputs || {};
  const blocking = [];

  collectBlocking(blocking, 'registration', payload.registrationCompleteness);
  collectBlocking(blocking, 'user_summary', payload.userSummaryCompleteness);
  collectBlocking(blocking, 'notification_summary', payload.notificationSummaryCompleteness);
  collectBlocking(blocking, 'checklist', payload.checklistCompleteness);
  collectBlocking(blocking, 'ops_state', payload.opsStateCompleteness);
  collectBlocking(blocking, 'ops_decision', payload.opsDecisionCompleteness);

  return {
    status: blocking.length === 0 ? 'READY' : 'NOT_READY',
    blocking
  };
}

module.exports = {
  evaluateOverallDecisionReadiness
};
