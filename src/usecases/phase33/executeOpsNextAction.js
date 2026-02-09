'use strict';

const { getOpsConsole } = require('../phase25/getOpsConsole');
const { runPhase2Automation } = require('../phase2/runAutomation');
const decisionLogsRepo = require('../../repos/firestore/decisionLogsRepo');
const opsStatesRepo = require('../../repos/firestore/opsStatesRepo');
const decisionDriftsRepo = require('../../repos/firestore/decisionDriftsRepo');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');
const { detectDecisionDrift } = require('../phase34/detectDecisionDrift');
const { createNotification } = require('../notifications/createNotification');
const { sendNotification } = require('../notifications/sendNotification');

const NEXT_ACTIONS = new Set(['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE']);

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} required`);
  }
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

function resolveToday(now) {
  return now.toISOString().slice(0, 10);
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

function evaluateExecutionGuard(params) {
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
  if (payload.latestDecisionLogId && payload.expectedDecisionLogId) {
    if (payload.latestDecisionLogId !== payload.expectedDecisionLogId) {
      reasons.push('stale_execution');
    }
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

function resolveEscalationTemplate(params) {
  const payload = params || {};
  if (payload.template && typeof payload.template === 'object') {
    return payload.template;
  }
  const linkRegistryId = process.env.OPS_ESCALATE_LINK_REGISTRY_ID || '';
  const scenarioKey = process.env.OPS_ESCALATE_SCENARIO_KEY || '';
  const stepKey = process.env.OPS_ESCALATE_STEP_KEY || '';
  const title = process.env.OPS_ESCALATE_TITLE || 'Ops Escalation';
  const body = process.env.OPS_ESCALATE_BODY || 'Ops escalation required.';
  const ctaText = process.env.OPS_ESCALATE_CTA_TEXT || 'Open';
  if (!linkRegistryId || !scenarioKey || !stepKey) return null;
  return {
    title,
    body,
    ctaText,
    linkRegistryId,
    scenarioKey,
    stepKey,
    target: {
      region: process.env.OPS_ESCALATE_TARGET_REGION || null,
      membersOnly: process.env.OPS_ESCALATE_TARGET_MEMBERS_ONLY === '1',
      limit: process.env.OPS_ESCALATE_TARGET_LIMIT
        ? Number(process.env.OPS_ESCALATE_TARGET_LIMIT)
        : 1
    },
    status: 'draft',
    createdBy: 'ops-execution'
  };
}

async function sendEscalationNotification(params, deps) {
  const payload = params || {};
  const template = resolveEscalationTemplate(payload);
  if (!template) {
    return { ok: false, error: 'notification template missing', sideEffects: ['notification_skipped'] };
  }
  const createFn = deps && deps.createNotification ? deps.createNotification : createNotification;
  const sendFn = deps && deps.sendNotification ? deps.sendNotification : sendNotification;
  const created = await createFn(template);
  const sent = await sendFn({ notificationId: created.id });
  return {
    ok: true,
    notificationId: created.id,
    deliveredCount: sent.deliveredCount,
    sideEffects: ['notification_sent']
  };
}

async function executeOpsNextAction(params, deps) {
  const payload = params || {};
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');
  const decisionLogId = requireString(payload.decisionLogId, 'decisionLogId');
  const action = requireEnum(payload.action, 'action', NEXT_ACTIONS);
  const traceId = optionalString(payload.traceId);
  const requestId = optionalString(payload.requestId);

  const consoleFn = deps && deps.getOpsConsole ? deps.getOpsConsole : getOpsConsole;
  const decisionLogs = deps && deps.decisionLogsRepo ? deps.decisionLogsRepo : decisionLogsRepo;
  const opsStates = deps && deps.opsStatesRepo ? deps.opsStatesRepo : opsStatesRepo;
  const decisionDrifts = deps && deps.decisionDriftsRepo ? deps.decisionDriftsRepo : decisionDriftsRepo;
  const timelineRepo = deps && Object.prototype.hasOwnProperty.call(deps, 'decisionTimelineRepo')
    ? deps.decisionTimelineRepo
    : (deps ? null : decisionTimelineRepo);
  const detectDriftFn = deps && deps.detectDecisionDrift ? deps.detectDecisionDrift : detectDecisionDrift;
  const now = deps && typeof deps.nowFn === 'function' ? deps.nowFn() : new Date();
  let executionGuard = { ok: true, status: 'OK', reasons: [] };
  let executeTimelineWritten = false;
  const appendExecuteTimeline = async (notificationId, snapshot) => {
    if (executeTimelineWritten) return;
    executeTimelineWritten = true;
    await appendTimelineBestEffort(timelineRepo, {
      lineUserId,
      source: 'ops',
      action: 'EXECUTE',
      refId: decisionLogId,
      notificationId,
      snapshot
    });
  };

  let existingDecision = null;
  let notificationId = null;
  try {
    const latestDecisionPromise = decisionLogs && typeof decisionLogs.getLatestDecision === 'function'
      ? decisionLogs.getLatestDecision('user', lineUserId)
      : Promise.resolve(null);
    const [consoleResult, already, latestDecisionLog] = await Promise.all([
      consoleFn({ lineUserId }, deps),
      decisionLogs.listDecisions('ops_execution', decisionLogId, 1),
      latestDecisionPromise
    ]);
    if (already && already.length) throw new Error('already executed');

    existingDecision = await decisionLogs.getDecisionById(decisionLogId);
    if (!existingDecision) throw new Error('decisionLogId not found');
    notificationId = existingDecision.audit ? existingDecision.audit.notificationId : null;

    const readiness = consoleResult ? consoleResult.readiness : null;
    const opsState = consoleResult && consoleResult.opsState ? consoleResult.opsState : null;
    if (!readiness || readiness.status !== 'READY') throw new Error('readiness not ready');

    const allowedNextActions = consoleResult && Array.isArray(consoleResult.allowedNextActions)
      ? consoleResult.allowedNextActions
      : [];
    if (allowedNextActions.length && !allowedNextActions.includes(action)) {
      throw new Error('invalid nextAction');
    }

    executionGuard = evaluateExecutionGuard({
      consoleServerTime: payload.consoleServerTime,
      maxConsoleAgeMs: payload.maxConsoleAgeMs,
      nowMs: now.getTime(),
      latestDecisionLogId: latestDecisionLog ? latestDecisionLog.id : null,
      expectedDecisionLogId: decisionLogId
    });
    if (!executionGuard.ok) {
      await appendExecuteTimeline(notificationId, {
        ok: false,
        error: 'ops_safety_guard_failed',
        guard: executionGuard
      });
      throw new Error('ops safety guard failed');
    }

    const executionContext = {
      failure_class: opsState && opsState.failure_class ? opsState.failure_class : null,
      reasonCode: opsState && opsState.reasonCode ? opsState.reasonCode : null,
      stage: opsState && opsState.stage ? opsState.stage : null,
      note: opsState && typeof opsState.note === 'string' ? opsState.note : null
    };

    const execution = {
      action,
      result: 'SUCCESS',
      sideEffects: [],
      executedAt: now.toISOString()
    };

    let error = null;
    try {
      if (action === 'NO_ACTION') {
        execution.sideEffects.push('no_action');
      } else if (action === 'RERUN_MAIN') {
        const runner = deps && deps.runPhase2Automation ? deps.runPhase2Automation : runPhase2Automation;
        const result = await runner({
          runId: `ops-rerun:${decisionLogId}`,
          targetDate: resolveToday(now),
          dryRun: false,
          logger: (msg) => console.log(msg)
        });
        if (!result || !result.ok) {
          execution.result = 'FAIL';
          execution.sideEffects.push('workflow_trigger_failed');
          error = result ? result.error : 'workflow failed';
        } else {
          execution.sideEffects.push('workflow_triggered');
        }
      } else if (action === 'FIX_AND_RERUN') {
        await opsStates.upsertOpsState(lineUserId, {
          note: `FIX_AND_RERUN:${decisionLogId}`
        });
        execution.sideEffects.push('ops_note_created');
        if (deps && typeof deps.createTodo === 'function') {
          await deps.createTodo({ lineUserId, decisionLogId });
          execution.sideEffects.push('todo_created');
        } else {
          execution.sideEffects.push('todo_skipped');
        }
        if (deps && typeof deps.createChecklist === 'function') {
          await deps.createChecklist({ lineUserId, decisionLogId });
          execution.sideEffects.push('checklist_created');
        } else {
          execution.sideEffects.push('checklist_skipped');
        }
      } else if (action === 'STOP_AND_ESCALATE') {
        const notifier = deps && deps.notifyEscalation ? deps.notifyEscalation : sendEscalationNotification;
        const notifyResult = await notifier({ lineUserId, decisionLogId }, deps);
        if (!notifyResult || notifyResult.ok === false) {
          execution.result = 'FAIL';
          execution.sideEffects = execution.sideEffects.concat(
            notifyResult && notifyResult.sideEffects ? notifyResult.sideEffects : ['notification_failed']
          );
          error = notifyResult ? notifyResult.error : 'notification failed';
        } else {
          execution.sideEffects = execution.sideEffects.concat(
            notifyResult.sideEffects || ['notification_sent']
          );
        }
      }
    } catch (err) {
      execution.result = 'FAIL';
      error = err && err.message ? err.message : 'execution failed';
    }

    const executionLog = await decisionLogs.appendDecision({
      subjectType: 'ops_execution',
      subjectId: decisionLogId,
      decision: 'EXECUTE',
      nextAction: action,
      decidedBy: 'system',
      reason: error ? `error:${error}` : 'execution',
      traceId,
      requestId,
      audit: {
        execution,
        lineUserId,
        decisionLogId,
        executionContext,
        traceId,
        requestId
      }
    });

    await appendExecuteTimeline(notificationId, {
      ok: execution.result === 'SUCCESS',
      error,
      guard: executionGuard,
      execution
    });

    let decisionDrift = null;
    const llmSuggestion = payload.llmSuggestion || null;
    if (llmSuggestion) {
      const opsDecisionSnapshot = payload.opsDecisionSnapshot || {
        lineUserId,
        readiness,
        allowedNextActions,
        selectedAction: existingDecision ? existingDecision.nextAction : action
      };
      decisionDrift = await detectDriftFn({
        decisionLog: existingDecision,
        opsDecisionSnapshot,
        llmSuggestion,
        executionResult: { execution }
      }, deps);
      if (decisionDrift && decisionDrift.driftDetected) {
        await decisionDrifts.appendDecisionDrift({
          decisionLogId,
          lineUserId,
          driftTypes: decisionDrift.driftTypes,
          severity: decisionDrift.severity,
          snapshot: {
            decisionLog: existingDecision,
            opsDecisionSnapshot,
            llmSuggestion,
            executionResult: { execution }
          }
        });
      }
    }

    return {
      ok: execution.result === 'SUCCESS',
      execution,
      executionLogId: executionLog.id,
      error,
      decisionDrift
    };
  } catch (err) {
    await appendExecuteTimeline(notificationId, {
      ok: false,
      error: err && err.message ? err.message : 'execution_failed',
      guard: executionGuard
    });
    throw err;
  }
}

module.exports = {
  executeOpsNextAction
};
