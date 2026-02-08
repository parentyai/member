'use strict';

const decisionLogsRepo = require('../../repos/firestore/decisionLogsRepo');

function normalizeExecutionResult(result) {
  if (result === 'SUCCESS' || result === 'OK') return 'OK';
  if (result === 'FAIL') return 'FAIL';
  return 'UNKNOWN';
}

function resolveTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

async function getNotificationDecisionTrace(notificationId, deps) {
  if (!notificationId) {
    return {
      firstDecisionLogId: null,
      lastDecisionLogId: null,
      lastExecutionResult: 'UNKNOWN',
      lastExecutedAt: null
    };
  }

  const decisionLogs = deps && deps.decisionLogsRepo ? deps.decisionLogsRepo : decisionLogsRepo;
  const decisions = await decisionLogs.listDecisionsByNotificationId(notificationId, 100, 'desc');
  if (!decisions.length) {
    return {
      firstDecisionLogId: null,
      lastDecisionLogId: null,
      lastExecutionResult: 'UNKNOWN',
      lastExecutedAt: null
    };
  }

  const lastDecision = decisions[0];
  const firstDecision = decisions[decisions.length - 1];
  let executionLog = null;
  if (lastDecision && lastDecision.id) {
    executionLog = await decisionLogs.getLatestDecision('ops_execution', lastDecision.id);
  }
  const execution = executionLog && executionLog.audit ? executionLog.audit.execution : null;

  return {
    firstDecisionLogId: firstDecision ? firstDecision.id : null,
    lastDecisionLogId: lastDecision ? lastDecision.id : null,
    lastExecutionResult: normalizeExecutionResult(execution && execution.result),
    lastExecutedAt: resolveTimestamp(execution && execution.executedAt)
      || resolveTimestamp(executionLog && executionLog.decidedAt)
      || resolveTimestamp(executionLog && executionLog.createdAt)
  };
}

module.exports = {
  getNotificationDecisionTrace
};
