'use strict';

const crypto = require('crypto');

const { getOpsConsole } = require('./getOpsConsole');
const decisionLogsRepo = require('../../repos/firestore/decisionLogsRepo');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');
const {
  recordOpsNextAction,
  NEXT_ACTIONS,
  FAILURE_CLASSES
} = require('../phase24/recordOpsNextAction');
const { emitObs } = require('../../ops/obs');
const { appendAuditLog } = require('../audit/appendAuditLog');

function requireString(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} required`);
  if (value.trim().length === 0) throw new Error(`${label} required`);
  return value.trim();
}

function requireEnum(value, label, allowed) {
  if (!allowed.has(value)) throw new Error(`invalid ${label}`);
  return value;
}

function formatValue(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

function resolveTraceId(traceId, requestId) {
  if (typeof traceId === 'string' && traceId.trim().length > 0) return traceId.trim();
  if (typeof requestId === 'string' && requestId.trim().length > 0 && requestId !== 'unknown') return requestId.trim();
  return crypto.randomUUID();
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  for (let idx = 0; idx < left.length; idx += 1) {
    if (left[idx] !== right[idx]) return false;
  }
  return true;
}

function buildPostCheck(params) {
  const payload = params || {};
  const opsState = payload.opsState || null;
  const decisionLogId = payload.decisionLogId || null;
  const decisionLog = payload.decisionLog || null;
  const readinessStatus = payload.readinessStatus || null;
  const allowedNextActions = Array.isArray(payload.allowedNextActions) ? payload.allowedNextActions : [];

  const checks = [];

  const opsStateSourceId = opsState ? opsState.sourceDecisionLogId : null;
  const sourceOk = Boolean(opsStateSourceId && decisionLogId && opsStateSourceId === decisionLogId);
  checks.push({
    name: 'ops_state_source_decision_log',
    ok: sourceOk,
    detail: `opsState.sourceDecisionLogId=${formatValue(opsStateSourceId)} decisionLogId=${formatValue(decisionLogId)}`
  });

  const auditReadiness = decisionLog && decisionLog.audit ? decisionLog.audit.readinessStatus : null;
  const readinessOk = Boolean(auditReadiness && readinessStatus && auditReadiness === readinessStatus);
  checks.push({
    name: 'decision_log_readiness_status',
    ok: readinessOk,
    detail: `expected=${formatValue(readinessStatus)} actual=${formatValue(auditReadiness)}`
  });

  const auditAllowed = decisionLog && decisionLog.audit ? decisionLog.audit.allowedNextActions : null;
  const allowedOk = arraysEqual(auditAllowed, allowedNextActions);
  checks.push({
    name: 'decision_log_allowed_next_actions',
    ok: allowedOk,
    detail: `expected=${formatValue(allowedNextActions)} actual=${formatValue(auditAllowed)}`
  });

  return { ok: checks.every((check) => check.ok), checks };
}

function buildAudit(consoleResult, notificationId, decidedNextAction, traceId, requestId, notificationMitigationDecision) {
  const readiness = consoleResult && consoleResult.readiness ? consoleResult.readiness : null;
  return {
    readinessStatus: readiness && readiness.status ? readiness.status : null,
    blocking: readiness && Array.isArray(readiness.blocking) ? readiness.blocking : [],
    recommendedNextAction: consoleResult ? consoleResult.recommendedNextAction : null,
    allowedNextActions: consoleResult && Array.isArray(consoleResult.allowedNextActions)
      ? consoleResult.allowedNextActions
      : [],
    decidedNextAction: decidedNextAction || null,
    consoleServerTime: consoleResult && consoleResult.serverTime ? consoleResult.serverTime : null,
    phaseResult: consoleResult && consoleResult.phaseResult ? consoleResult.phaseResult : null,
    closeDecision: consoleResult && consoleResult.closeDecision ? consoleResult.closeDecision : null,
    closeReason: consoleResult && consoleResult.closeReason ? consoleResult.closeReason : null,
    notificationId: notificationId || null,
    traceId: traceId || null,
    requestId: requestId || null,
    mitigationSuggestion: consoleResult && consoleResult.mitigationSuggestion ? consoleResult.mitigationSuggestion : null,
    notificationMitigationDecision: notificationMitigationDecision || null
  };
}

function parseNotificationMitigationDecision(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object') throw new Error('invalid notificationMitigationDecision');
  const decision = typeof value.decision === 'string' ? value.decision : '';
  const allowed = new Set(['ADOPT', 'REJECT', 'SKIP']);
  if (!allowed.has(decision)) throw new Error('invalid notificationMitigationDecision');
  const note = typeof value.note === 'string' ? value.note : '';
  const actionType = typeof value.actionType === 'string' ? value.actionType : null;
  const targetNotificationId = typeof value.targetNotificationId === 'string' ? value.targetNotificationId : null;
  return {
    decision,
    note: note || '',
    actionType,
    targetNotificationId
  };
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return null;
}

function evaluateSafetyGuard(params) {
  const payload = params || {};
  const reasons = [];
  const nowMs = typeof payload.nowMs === 'number' ? payload.nowMs : Date.now();
  const maxAgeMs = typeof payload.maxConsoleAgeMs === 'number' ? payload.maxConsoleAgeMs : 5 * 60 * 1000;
  if (payload.consoleServerTime !== undefined && payload.consoleServerTime !== null) {
    const consoleMs = toMillis(payload.consoleServerTime);
    if (!consoleMs) {
      reasons.push('invalid_console_time');
    } else if (nowMs - consoleMs > maxAgeMs) {
      reasons.push('stale_console');
    }
  }
  const consoleResult = payload.consoleResult || null;
  const opsState = consoleResult ? consoleResult.opsState : null;
  const latestDecisionLog = consoleResult ? consoleResult.latestDecisionLog : null;
  if (
    opsState &&
    opsState.sourceDecisionLogId &&
    latestDecisionLog &&
    latestDecisionLog.id &&
    opsState.sourceDecisionLogId !== latestDecisionLog.id
  ) {
    reasons.push('decision_source_mismatch');
  }
  return {
    ok: reasons.length === 0,
    status: reasons.length === 0 ? 'OK' : 'FAIL',
    reasons
  };
}

async function appendTimelineBestEffort(repo, entry) {
  if (!repo || typeof repo.appendTimelineEntry !== 'function') return;
  try {
    await repo.appendTimelineEntry(entry);
  } catch (err) {
    // best-effort only
  }
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
  const notificationId = payload.notificationId || null;
  const source = typeof payload.source === 'string' ? payload.source : 'ops_console';
  const suggestionSnapshot = payload.suggestionSnapshot && typeof payload.suggestionSnapshot === 'object'
    ? payload.suggestionSnapshot
    : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0 ? payload.requestId.trim() : null;
  const actor = typeof payload.actor === 'string' && payload.actor.trim().length > 0 ? payload.actor.trim() : null;
  const traceId = resolveTraceId(payload.traceId, requestId);
  const notificationMitigationDecision = parseNotificationMitigationDecision(payload.notificationMitigationDecision);

  const consoleFn = deps && deps.getOpsConsole ? deps.getOpsConsole : getOpsConsole;
  const recordFn = deps && deps.recordOpsNextAction ? deps.recordOpsNextAction : recordOpsNextAction;
  const decisionLogs = deps && deps.decisionLogsRepo
    ? deps.decisionLogsRepo
    : (deps && deps.recordOpsNextAction ? null : decisionLogsRepo);
  const timelineRepo = deps && Object.prototype.hasOwnProperty.call(deps, 'decisionTimelineRepo')
    ? deps.decisionTimelineRepo
    : (deps ? null : decisionTimelineRepo);
  let decideTimelineWritten = false;
  const appendDecideTimeline = async (refId, snapshot) => {
    if (decideTimelineWritten) return;
    decideTimelineWritten = true;
    await appendTimelineBestEffort(timelineRepo, {
      lineUserId,
      source: 'ops',
      action: 'DECIDE',
      refId,
      notificationId,
      traceId,
      requestId,
      actor: actor || decidedBy || 'unknown',
      snapshot
    });
  };

  const consoleResult = await consoleFn({ lineUserId });
  const readiness = consoleResult ? consoleResult.readiness : null;
  const consistency = consoleResult ? consoleResult.consistency : null;
  const allowedNextActions = consoleResult && Array.isArray(consoleResult.allowedNextActions)
    ? consoleResult.allowedNextActions
    : [];
  const closeDecision = consoleResult ? consoleResult.closeDecision : null;
  const audit = buildAudit(consoleResult, notificationId, nextAction, traceId, requestId, notificationMitigationDecision);
  const safetyGuard = evaluateSafetyGuard({
    consoleResult,
    consoleServerTime: payload.consoleServerTime,
    maxConsoleAgeMs: payload.maxConsoleAgeMs
  });
  if (!safetyGuard.ok) {
    await appendDecideTimeline(null, {
      ok: false,
      error: 'ops_safety_guard_failed',
      guard: safetyGuard,
      nextAction,
      failure_class: failureClass,
      reasonCode,
      stage,
      note,
      decidedBy
    });
    throw new Error('ops safety guard failed');
  }

  try {
    if (consistency && consistency.status === 'FAIL') {
      throw new Error('invalid consistency');
    }
    if (closeDecision === 'CLOSE') {
      throw new Error('closeDecision closed');
    }
    if (closeDecision === 'NO_CLOSE' && nextAction !== 'NO_ACTION' && nextAction !== 'STOP_AND_ESCALATE') {
      throw new Error('closeDecision: NO_CLOSE');
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
        postCheck: { ok: true, checks: [] },
        dryRun: true
      };
    }
  } catch (err) {
    if (!dryRun) {
      await appendDecideTimeline(null, {
        ok: false,
        error: err && err.message ? err.message : 'decision_failed',
        guard: safetyGuard,
        nextAction,
        failure_class: failureClass,
        reasonCode,
        stage,
        note,
        decidedBy
      });
    }
    try {
      emitObs({
        action: 'ops_decision_submit',
        result: 'error',
        lineUserId,
        meta: {
          nextAction,
          failure_class: failureClass,
          reason: err && err.message ? err.message : 'error'
        }
      });
    } catch (emitErr) {
      // best-effort only
    }
    throw err;
  }

  let result;
  try {
    result = await recordFn({
      lineUserId,
      nextAction,
      failure_class: failureClass,
      reasonCode,
      stage,
      note,
      decidedBy,
      traceId,
      requestId,
      audit,
      source,
      suggestionSnapshot
    });
  } catch (err) {
    await appendDecideTimeline(null, {
      ok: false,
      error: err && err.message ? err.message : 'record_failed',
      guard: safetyGuard,
      nextAction,
      failure_class: failureClass,
      reasonCode,
      stage,
      note,
      decidedBy
    });
    try {
      emitObs({
        action: 'ops_decision_submit',
        result: 'error',
        lineUserId,
        meta: {
          nextAction,
          failure_class: failureClass,
          reason: err && err.message ? err.message : 'record_failed'
        }
      });
    } catch (emitErr) {
      // best-effort only
    }
    throw err;
  }

  let decisionLog = null;
  if (decisionLogs && typeof decisionLogs.getDecisionById === 'function') {
    decisionLog = await decisionLogs.getDecisionById(result.decisionLogId);
  }
  const postCheck = buildPostCheck({
    opsState: result.opsState,
    decisionLogId: result.decisionLogId,
    decisionLog,
    readinessStatus: readiness ? readiness.status : null,
    allowedNextActions: audit.allowedNextActions
  });

  try {
    await appendAuditLog({
      actor: actor || decidedBy || 'unknown',
      action: 'ops_decision.submit',
      entityType: 'user',
      entityId: lineUserId,
      traceId,
      requestId,
      payloadSummary: {
        lineUserId,
        readinessStatus: audit.readinessStatus || null,
        decidedNextAction: nextAction,
        decisionLogId: result.decisionLogId,
        notificationMitigationDecision
      }
    });
  } catch (_err) {
    // best-effort only
  }

  if (notificationMitigationDecision) {
    try {
      await appendAuditLog({
        actor: actor || decidedBy || 'unknown',
        action: 'notification_mitigation.decision',
        entityType: 'user',
        entityId: lineUserId,
        traceId,
        requestId,
        payloadSummary: {
          lineUserId,
          notificationMitigationDecision,
          decisionLogId: result.decisionLogId
        }
      });
    } catch (_err) {
      // best-effort only
    }
  }

  await appendDecideTimeline(result.decisionLogId, {
    ok: true,
    guard: safetyGuard,
    nextAction,
    failure_class: failureClass,
    reasonCode,
    stage,
    note,
    decidedBy,
    notificationMitigationDecision
  });

  await appendTimelineBestEffort(timelineRepo, {
    lineUserId,
    source: 'system',
    action: 'POSTCHECK',
    refId: result.decisionLogId,
    notificationId,
    snapshot: postCheck
  });

  const response = {
    ok: true,
    readiness,
    audit,
    traceId,
    requestId,
    decisionLogId: result.decisionLogId,
    opsState: result.opsState,
    postCheck,
    dryRun: false
  };

  try {
    emitObs({
      action: 'ops_decision_submit',
      result: 'ok',
      lineUserId,
      meta: {
        nextAction,
        failure_class: failureClass,
        decisionLogId: result.decisionLogId
      }
    });
  } catch (emitErr) {
    // best-effort only
  }

  return response;
}

module.exports = {
  submitOpsDecision
};
