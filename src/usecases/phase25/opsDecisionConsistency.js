'use strict';

const opsStatesRepo = require('../../repos/firestore/opsStatesRepo');
const decisionLogsRepo = require('../../repos/firestore/decisionLogsRepo');

const FAIL_ISSUES = new Set([
  'ops_state_source_mismatch',
  'missing_audit_snapshot',
  'not_ready_but_non_escalate'
]);

function requireString(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} required`);
  if (value.trim().length === 0) throw new Error(`${label} required`);
  return value.trim();
}

function hasAuditSnapshot(audit) {
  if (!audit || typeof audit !== 'object') return false;
  if (typeof audit.readinessStatus !== 'string') return false;
  if (!Array.isArray(audit.blocking)) return false;
  if (typeof audit.recommendedNextAction !== 'string') return false;
  if (!Array.isArray(audit.allowedNextActions)) return false;
  return true;
}

async function getOpsDecisionConsistency(params, deps) {
  const payload = params || {};
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');

  const opsStates = deps && deps.opsStatesRepo ? deps.opsStatesRepo : opsStatesRepo;
  const decisionLogs = deps && deps.decisionLogsRepo ? deps.decisionLogsRepo : decisionLogsRepo;

  const [opsState, latestDecisionLog] = await Promise.all([
    opsStates.getOpsState(lineUserId),
    decisionLogs.getLatestDecision('user', lineUserId)
  ]);

  const issues = [];

  if (!opsState) issues.push('missing_ops_state');
  if (!latestDecisionLog) issues.push('missing_latest_decision_log');

  if (opsState && latestDecisionLog) {
    if (opsState.sourceDecisionLogId !== latestDecisionLog.id) {
      issues.push('ops_state_source_mismatch');
    }
    if (!hasAuditSnapshot(latestDecisionLog.audit)) {
      issues.push('missing_audit_snapshot');
    } else if (
      latestDecisionLog.audit.readinessStatus === 'NOT_READY' &&
      latestDecisionLog.nextAction !== 'STOP_AND_ESCALATE'
    ) {
      issues.push('not_ready_but_non_escalate');
    }
  }

  let status = 'OK';
  if (issues.some((issue) => FAIL_ISSUES.has(issue))) status = 'FAIL';
  else if (issues.length) status = 'WARN';

  return { status, issues };
}

module.exports = {
  getOpsDecisionConsistency
};
