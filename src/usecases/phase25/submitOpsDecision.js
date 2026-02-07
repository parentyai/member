'use strict';

const { getOpsConsole } = require('./getOpsConsole');
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

function buildAudit(consoleResult) {
  const readiness = consoleResult && consoleResult.readiness ? consoleResult.readiness : null;
  return {
    readinessStatus: readiness && readiness.status ? readiness.status : null,
    blocking: readiness && Array.isArray(readiness.blocking) ? readiness.blocking : [],
    recommendedNextAction: consoleResult ? consoleResult.recommendedNextAction : null,
    allowedNextActions: consoleResult && Array.isArray(consoleResult.allowedNextActions)
      ? consoleResult.allowedNextActions
      : [],
    consoleServerTime: consoleResult && consoleResult.serverTime ? consoleResult.serverTime : null
  };
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

  const consoleFn = deps && deps.getOpsConsole ? deps.getOpsConsole : getOpsConsole;
  const recordFn = deps && deps.recordOpsNextAction ? deps.recordOpsNextAction : recordOpsNextAction;

  const consoleResult = await consoleFn({ lineUserId });
  const readiness = consoleResult ? consoleResult.readiness : null;
  const consistency = consoleResult ? consoleResult.consistency : null;
  const allowedNextActions = consoleResult && Array.isArray(consoleResult.allowedNextActions)
    ? consoleResult.allowedNextActions
    : [];
  const audit = buildAudit(consoleResult);

  if (consistency && consistency.status === 'FAIL') {
    throw new Error('invalid consistency');
  }
  if (allowedNextActions.length && !allowedNextActions.includes(nextAction)) {
    throw new Error('invalid nextAction');
  }
  if (readiness && readiness.status === 'NOT_READY' && nextAction !== 'STOP_AND_ESCALATE') {
    throw new Error('invalid nextAction');
  }

  if (dryRun) {
    return {
      ok: true,
      readiness,
      audit,
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
    decidedBy,
    audit
  });

  return {
    ok: true,
    readiness,
    audit,
    decisionLogId: result.decisionLogId,
    opsState: result.opsState,
    dryRun: false
  };
}

module.exports = {
  submitOpsDecision
};
