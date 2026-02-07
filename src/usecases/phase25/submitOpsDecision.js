'use strict';

const { getUserStateSummary } = require('../phase5/getUserStateSummary');
const { evaluateOverallDecisionReadiness } = require('../phase24/overallDecisionReadiness');
const {
  recordOpsNextAction,
  NEXT_ACTIONS,
  FAILURE_CLASSES
} = require('../phase24/recordOpsNextAction');

function requireString(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} required`);
  if (value.trim().length === 0) throw new Error(`${label} required`);
  return value.trim();
}

function requireEnum(value, label, allowed) {
  if (!allowed.has(value)) throw new Error(`invalid ${label}`);
  return value;
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

async function submitOpsDecision(input, deps) {
  const payload = input || {};
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');
  const decision = payload.decision || {};
  const nextAction = requireEnum(decision.nextAction, 'nextAction', NEXT_ACTIONS);
  const failureClass = requireEnum(decision.failure_class, 'failure_class', FAILURE_CLASSES);
  const decidedBy = requireString(payload.decidedBy || 'ops', 'decidedBy');
  const reasonCode = decision.reasonCode || null;
  const stage = decision.stage || null;
  const note = typeof decision.note === 'string' ? decision.note : '';
  const dryRun = Boolean(payload.dryRun);

  const summaryFn = deps && deps.getUserStateSummary ? deps.getUserStateSummary : getUserStateSummary;
  const readinessFn = deps && deps.evaluateOverallDecisionReadiness
    ? deps.evaluateOverallDecisionReadiness
    : evaluateOverallDecisionReadiness;
  const recordFn = deps && deps.recordOpsNextAction ? deps.recordOpsNextAction : recordOpsNextAction;

  const summary = await summaryFn({ lineUserId });
  const readiness = buildReadiness(summary, readinessFn);

  if (dryRun) {
    return {
      ok: true,
      readiness,
      decisionLogId: null,
      opsState: {
        id: lineUserId,
        nextAction,
        failure_class: failureClass,
        reasonCode,
        stage,
        note,
        sourceDecisionLogId: null,
        updatedAt: null
      },
      dryRun: true
    };
  }

  const result = await recordFn({
    lineUserId,
    nextAction,
    failure_class: failureClass,
    reasonCode,
    stage,
    note,
    decidedBy
  });

  return {
    ok: true,
    readiness,
    decisionLogId: result.decisionLogId,
    opsState: result.opsState,
    dryRun: false
  };
}

module.exports = {
  submitOpsDecision
};
