'use strict';

const decisionLogsRepo = require('../../repos/firestore/decisionLogsRepo');
const decisionDriftsRepo = require('../../repos/firestore/decisionDriftsRepo');
const { getUserStateSummary } = require('../phase5/getUserStateSummary');
const { getMemberSummary } = require('../phase6/getMemberSummary');
const { evaluateOverallDecisionReadiness } = require('../phase24/overallDecisionReadiness');
const { getOpsDecisionConsistency } = require('./opsDecisionConsistency');
const { evaluateCloseDecision } = require('./closeDecision');
const { emitObs } = require('../../ops/obs');
const { suggestNotificationTemplate } = require('../phase53/suggestNotificationTemplate');

function requireString(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} required`);
  if (value.trim().length === 0) throw new Error(`${label} required`);
  return value.trim();
}

function buildReadiness(summary, evaluator) {
  const checklistCompleteness = summary && summary.checklist ? summary.checklist.completeness : null;
  return evaluator({
    registrationCompleteness: summary ? summary.registrationCompleteness : null,
    userSummaryCompleteness: summary ? summary.userSummaryCompleteness : null,
    notificationSummaryCompleteness: null,
    checklistCompleteness,
    opsStateCompleteness: summary ? summary.opsStateCompleteness : null,
    opsDecisionCompleteness: summary ? summary.opsDecisionCompleteness : null
  });
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

function normalizeExecutionResult(value) {
  if (value === 'SUCCESS' || value === 'OK') return 'OK';
  if (value === 'FAIL') return 'FAIL';
  return 'UNKNOWN';
}

function buildExecutionStatus(executionLog) {
  if (!executionLog) {
    return {
      lastExecutedAt: null,
      lastExecutionResult: 'UNKNOWN',
      lastFailureClass: null,
      lastReasonCode: null,
      lastStage: null,
      lastNote: null
    };
  }
  const audit = executionLog.audit && typeof executionLog.audit === 'object'
    ? executionLog.audit
    : {};
  const execution = audit.execution && typeof audit.execution === 'object'
    ? audit.execution
    : {};
  const context = audit.executionContext && typeof audit.executionContext === 'object'
    ? audit.executionContext
    : {};
  const executedAt = resolveTimestamp(execution.executedAt)
    || resolveTimestamp(executionLog.decidedAt)
    || resolveTimestamp(executionLog.createdAt);
  return {
    lastExecutedAt: executedAt,
    lastExecutionResult: normalizeExecutionResult(execution.result),
    lastFailureClass: typeof context.failure_class === 'string' ? context.failure_class : null,
    lastReasonCode: typeof context.reasonCode === 'string' ? context.reasonCode : null,
    lastStage: typeof context.stage === 'string' ? context.stage : null,
    lastNote: typeof context.note === 'string' ? context.note : null
  };
}

async function getOpsConsole(params, deps) {
  const payload = params || {};
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');

  const userSummaryFn = deps && deps.getUserStateSummary ? deps.getUserStateSummary : getUserStateSummary;
  const memberSummaryFn = deps && deps.getMemberSummary ? deps.getMemberSummary : getMemberSummary;
  const readinessFn = deps && deps.evaluateOverallDecisionReadiness
    ? deps.evaluateOverallDecisionReadiness
    : evaluateOverallDecisionReadiness;
  const consistencyFn = deps && deps.getOpsDecisionConsistency
    ? deps.getOpsDecisionConsistency
    : getOpsDecisionConsistency;
  const decisionLogs = deps && deps.decisionLogsRepo ? deps.decisionLogsRepo : decisionLogsRepo;
  const decisionDrifts = deps && Object.prototype.hasOwnProperty.call(deps, 'decisionDriftsRepo')
    ? deps.decisionDriftsRepo
    : (deps ? null : decisionDriftsRepo);

  const [userStateSummary, memberSummary] = await Promise.all([
    userSummaryFn({ lineUserId }),
    memberSummaryFn({ lineUserId })
  ]);

  const readiness = userStateSummary && userStateSummary.overallDecisionReadiness
    ? userStateSummary.overallDecisionReadiness
    : buildReadiness(userStateSummary, readinessFn);

  const consistency = await consistencyFn({ lineUserId }, deps);
  let effectiveReadiness = readiness;
  if (consistency && consistency.status !== 'OK') {
    const existing = readiness && Array.isArray(readiness.blocking) ? readiness.blocking : [];
    const extra = (consistency.issues || []).map((issue) => `consistency:${issue}`);
    effectiveReadiness = Object.assign({}, readiness || {}, {
      status: 'NOT_READY',
      blocking: existing.concat(extra)
    });
  }

  const [latestDecisionLog, latestDecisionDrift] = await Promise.all([
    decisionLogs.getLatestDecision('user', lineUserId),
    decisionDrifts && typeof decisionDrifts.getLatestDecisionDrift === 'function'
      ? decisionDrifts.getLatestDecisionDrift(lineUserId)
      : Promise.resolve(null)
  ]);
  const latestExecutionLog = latestDecisionLog
    ? await decisionLogs.getLatestDecision('ops_execution', latestDecisionLog.id)
    : null;
  const opsState = userStateSummary ? userStateSummary.opsState : null;
  const opsNextAction = opsState ? opsState.nextAction : null;
  let allowedNextActions = ['STOP_AND_ESCALATE'];
  let recommendedNextAction = 'STOP_AND_ESCALATE';
  if (effectiveReadiness && effectiveReadiness.status === 'READY') {
    allowedNextActions = ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'];
    recommendedNextAction = allowedNextActions.includes(opsNextAction) ? opsNextAction : 'NO_ACTION';
  }
  const closeDecision = evaluateCloseDecision({ readiness: effectiveReadiness, consistency });
  const suggestedTemplate = await suggestNotificationTemplate({ nextAction: recommendedNextAction });
  const suggestedTemplateKey = suggestedTemplate ? suggestedTemplate.templateKey : null;
  let decisionDrift = { status: 'NONE', lastDetectedAt: null, types: [] };
  if (latestDecisionDrift) {
    const severity = latestDecisionDrift.severity === 'CRITICAL' ? 'CRITICAL' : 'WARN';
    decisionDrift = {
      status: severity,
      lastDetectedAt: resolveTimestamp(latestDecisionDrift.createdAt),
      types: Array.isArray(latestDecisionDrift.driftTypes) ? latestDecisionDrift.driftTypes : []
    };
  }
  const executionStatus = buildExecutionStatus(latestExecutionLog);

  const result = {
    ok: true,
    serverTime: new Date().toISOString(),
    lineUserId,
    userStateSummary,
    memberSummary,
    readiness: effectiveReadiness,
    recommendedNextAction,
    allowedNextActions,
    closeDecision: closeDecision.closeDecision,
    closeReason: closeDecision.closeReason,
    phaseResult: closeDecision.phaseResult,
    opsState,
    latestDecisionLog,
    consistency,
    decisionDrift,
    executionStatus,
    suggestedTemplateKey
  };

  try {
    emitObs({
      action: 'ops_console_get',
      result: 'ok',
      lineUserId,
      meta: {
        readiness: effectiveReadiness ? effectiveReadiness.status : null,
        recommendedNextAction,
        closeDecision: closeDecision.closeDecision,
        decisionDrift: decisionDrift.status,
        suggestedTemplateKey
      }
    });
  } catch (err) {
    // best-effort only
  }

  return result;
}

module.exports = {
  getOpsConsole
};
