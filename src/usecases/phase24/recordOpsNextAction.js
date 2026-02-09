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

function optionalString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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
  const audit = payload.audit && typeof payload.audit === 'object' ? payload.audit : null;
  const source = typeof payload.source === 'string' ? payload.source : 'ops_console';
  const suggestionSnapshot = payload.suggestionSnapshot && typeof payload.suggestionSnapshot === 'object'
    ? payload.suggestionSnapshot
    : null;
  const traceId = optionalString(payload.traceId);
  const requestId = optionalString(payload.requestId);

  const decisionLogs = deps && deps.decisionLogsRepo ? deps.decisionLogsRepo : decisionLogsRepo;
  const opsStates = deps && deps.opsStatesRepo ? deps.opsStatesRepo : opsStatesRepo;

  const decisionLogResult = await decisionLogs.appendDecision({
    subjectType: 'user',
    subjectId: lineUserId,
    decision: mapDecision(nextAction),
    nextAction,
    decidedBy,
    reason,
    traceId,
    requestId,
    audit,
    source,
    suggestionSnapshot
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
