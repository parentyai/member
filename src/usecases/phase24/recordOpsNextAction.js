'use strict';

const decisionLogsRepo = require('../../repos/firestore/decisionLogsRepo');
const opsStatesRepo = require('../../repos/firestore/opsStatesRepo');

const NEXT_ACTIONS = new Set(['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE']);
const FAILURE_CLASSES = new Set(['ENV', 'IMPL', 'CONFIG', 'UNKNOWN', 'PASS']);

function requireString(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} required`);
  if (value.trim().length === 0) throw new Error(`${label} required`);
  return value.trim();
}

function requireEnum(value, label, allowed) {
  if (!allowed.has(value)) throw new Error(`invalid ${label}`);
  return value;
}

function mapDecision(nextAction) {
  if (nextAction === 'NO_ACTION') return 'OK';
  if (nextAction === 'STOP_AND_ESCALATE') return 'ESCALATE';
  return 'HOLD';
}

async function recordOpsNextAction(input, deps) {
  const payload = input || {};
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');
  const nextAction = requireEnum(payload.nextAction, 'nextAction', NEXT_ACTIONS);
  const failureClass = requireEnum(payload.failure_class, 'failure_class', FAILURE_CLASSES);
  const decidedBy = requireString(payload.decidedBy || 'ops', 'decidedBy');
  const reason = typeof payload.note === 'string' ? payload.note : '';

  const decisionLogs = deps && deps.decisionLogsRepo ? deps.decisionLogsRepo : decisionLogsRepo;
  const opsStates = deps && deps.opsStatesRepo ? deps.opsStatesRepo : opsStatesRepo;

  const decisionLogResult = await decisionLogs.appendDecision({
    subjectType: 'user',
    subjectId: lineUserId,
    decision: mapDecision(nextAction),
    decidedBy,
    reason
  });

  const opsStatePayload = {
    nextAction,
    failure_class: failureClass,
    reasonCode: payload.reasonCode || null,
    stage: payload.stage || null,
    note: reason,
    sourceDecisionLogId: decisionLogResult.id
  };

  await opsStates.upsertOpsState(lineUserId, opsStatePayload);
  const opsState = await opsStates.getOpsState(lineUserId);
  return { decisionLogId: decisionLogResult.id, opsState };
}

module.exports = {
  recordOpsNextAction,
  NEXT_ACTIONS,
  FAILURE_CLASSES
};
