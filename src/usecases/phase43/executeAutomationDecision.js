// LEGACY_FROZEN_DO_NOT_USE
// reason: unreachable from current src/index.js route graph baseline (REPO_FULL_AUDIT_REPORT_2026-02-21).
// ssot_ref: docs/REPO_FULL_AUDIT_REPORT_2026-02-21.md
'use strict';

const automationConfigRepo = require('../../repos/firestore/automationConfigRepo');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { getOpsConsole } = require('../phase25/getOpsConsole');
const { submitOpsDecision } = require('../phase25/submitOpsDecision');
const { executeOpsNextAction } = require('../phase33/executeOpsNextAction');
const { emitObs } = require('../../ops/obs');

const DEFAULT_CONFIG = {
  enabled: false,
  allowedActions: [],
  requireConfirmation: true,
  mode: 'OFF'
};
const MODES = new Set(['OFF', 'DRY_RUN_ONLY', 'EXECUTE']);

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

function resolveConfig(config) {
  if (!config) return Object.assign({}, DEFAULT_CONFIG);
  const allowed = Array.isArray(config.allowedActions)
    ? config.allowedActions
    : (Array.isArray(config.allowNextActions) ? config.allowNextActions : []);
  const rawMode = typeof config.mode === 'string' ? config.mode.toUpperCase() : null;
  const mode = MODES.has(rawMode) ? rawMode : (config.enabled ? 'EXECUTE' : 'OFF');
  return {
    enabled: mode !== 'OFF',
    mode,
    allowedActions: allowed,
    requireConfirmation: config.requireConfirmation !== false
  };
}

function evaluateAutomationGuard(params) {
  const payload = params || {};
  const reasons = [];
  const readiness = payload.readiness;
  if (!readiness || readiness.status !== 'READY') reasons.push('readiness_not_ready');
  const consistency = payload.consistency;
  if (consistency && consistency.status && consistency.status !== 'OK') reasons.push('decision_consistency');
  const opsState = payload.opsState;
  const updatedAtMs = toMillis(opsState && opsState.updatedAt);
  const nowMs = typeof payload.nowMs === 'number' ? payload.nowMs : Date.now();
  const maxAgeMs = typeof payload.maxOpsStateAgeMs === 'number' ? payload.maxOpsStateAgeMs : 10 * 60 * 1000;
  if (opsState && !updatedAtMs) {
    reasons.push('ops_state_stale');
  } else if (updatedAtMs && nowMs - updatedAtMs > maxAgeMs) {
    reasons.push('ops_state_stale');
  }
  return {
    ok: reasons.length === 0,
    status: reasons.length === 0 ? 'OK' : 'FAIL',
    reasons
  };
}

function resolveRecentDryRun(payload) {
  if (payload.recentDryRun === true) return { ok: true };
  const atMs = toMillis(payload.recentDryRunAt);
  if (!atMs) return { ok: false };
  const nowMs = typeof payload.nowMs === 'number' ? payload.nowMs : Date.now();
  const maxAgeMs = typeof payload.maxDryRunAgeMs === 'number' ? payload.maxDryRunAgeMs : 10 * 60 * 1000;
  return { ok: nowMs - atMs <= maxAgeMs };
}

async function appendTimelineBestEffort(repo, entry) {
  if (!repo || typeof repo.appendTimelineEntry !== 'function') return;
  try {
    await repo.appendTimelineEntry(entry);
  } catch (err) {
    // best-effort only
  }
}

async function executeAutomationDecision(params, deps) {
  const payload = params || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');
  if (!payload.action) throw new Error('action required');
  if (!payload.decisionLogId) throw new Error('decisionLogId required');

  const configRepo = deps && deps.automationConfigRepo ? deps.automationConfigRepo : automationConfigRepo;
  const timelineRepo = deps && Object.prototype.hasOwnProperty.call(deps, 'decisionTimelineRepo')
    ? deps.decisionTimelineRepo
    : (deps ? null : decisionTimelineRepo);
  const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;
  const consoleFn = deps && deps.getOpsConsole ? deps.getOpsConsole : getOpsConsole;
  const submitFn = deps && deps.submitOpsDecision ? deps.submitOpsDecision : submitOpsDecision;
  const executeFn = deps && deps.executeOpsNextAction ? deps.executeOpsNextAction : executeOpsNextAction;

  let killSwitch = false;
  try {
    killSwitch = await killSwitchFn();
  } catch (err) {
    killSwitch = false;
  }
  if (killSwitch) {
    return { ok: false, skipped: true, reason: 'kill_switch_on', status: 409 };
  }

  const storedConfig = await configRepo.getLatestAutomationConfig();
  const config = resolveConfig(storedConfig);
  if (config.mode === 'OFF') {
    const response = { ok: false, skipped: true, reason: 'automation_disabled', config };
    try {
      emitObs({
        action: 'automation_execute',
        result: 'skip',
        lineUserId: payload.lineUserId,
        meta: { reason: response.reason, action: payload.action }
      });
    } catch (err) {
      // best-effort only
    }
    return response;
  }
  if (config.mode === 'DRY_RUN_ONLY') {
    const response = { ok: false, skipped: true, reason: 'automation_dry_run_only', config };
    try {
      emitObs({
        action: 'automation_execute',
        result: 'skip',
        lineUserId: payload.lineUserId,
        meta: { reason: response.reason, action: payload.action }
      });
    } catch (err) {
      // best-effort only
    }
    return response;
  }
  if (config.requireConfirmation && !payload.confirmed) {
    const response = { ok: false, skipped: true, reason: 'confirmation_required', config };
    try {
      emitObs({
        action: 'automation_execute',
        result: 'skip',
        lineUserId: payload.lineUserId,
        meta: { reason: response.reason, action: payload.action }
      });
    } catch (err) {
      // best-effort only
    }
    return response;
  }
  if (config.allowedActions.length && !config.allowedActions.includes(payload.action)) {
    const response = { ok: false, skipped: true, reason: 'action_not_allowed', config };
    try {
      emitObs({
        action: 'automation_execute',
        result: 'skip',
        lineUserId: payload.lineUserId,
        meta: { reason: response.reason, action: payload.action }
      });
    } catch (err) {
      // best-effort only
    }
    return response;
  }
  const recentDryRun = resolveRecentDryRun(payload);
  if (!recentDryRun.ok) {
    const response = { ok: false, skipped: true, reason: 'recent_dry_run_required', config };
    try {
      emitObs({
        action: 'automation_execute',
        result: 'skip',
        lineUserId: payload.lineUserId,
        meta: { reason: response.reason, action: payload.action }
      });
    } catch (err) {
      // best-effort only
    }
    return response;
  }

  const consoleResult = await consoleFn({ lineUserId: payload.lineUserId }, deps);
  const guard = evaluateAutomationGuard({
    readiness: consoleResult ? consoleResult.readiness : null,
    consistency: consoleResult ? consoleResult.consistency : null,
    opsState: consoleResult ? consoleResult.opsState : null,
    nowMs: typeof payload.nowMs === 'number' ? payload.nowMs : Date.now(),
    maxOpsStateAgeMs: payload.maxOpsStateAgeMs
  });

  await appendTimelineBestEffort(timelineRepo, {
    lineUserId: payload.lineUserId,
    source: 'system',
    action: 'AUTOMATION',
    refId: payload.decisionLogId,
    notificationId: payload.notificationId || null,
    snapshot: {
      ok: guard.ok,
      confirmedBy: payload.confirmedBy || null,
      confirmed: Boolean(payload.confirmed),
      config,
      guard
    }
  });

  if (!guard.ok) {
    let escalation = null;
    try {
      escalation = await submitFn({
        lineUserId: payload.lineUserId,
        decision: { nextAction: 'STOP_AND_ESCALATE', failure_class: 'UNKNOWN' },
        decidedBy: payload.confirmedBy || 'system',
        reasonCode: 'AUTOMATION_GUARD_FAIL',
        stage: 'phase44',
        note: 'automation_guard_failed',
        dryRun: false,
        notificationId: payload.notificationId || null,
        source: 'automation'
      }, deps);
    } catch (err) {
      const response = {
        ok: false,
        automated: false,
        reason: 'automation_guard_failed',
        guard,
        escalationError: err && err.message ? err.message : 'escalation_failed'
      };
      try {
        emitObs({
          action: 'automation_execute',
          result: 'fail',
          lineUserId: payload.lineUserId,
          meta: { reason: response.reason, action: payload.action }
        });
      } catch (emitErr) {
        // best-effort only
      }
      return response;
    }
    const response = {
      ok: false,
      automated: false,
      reason: 'automation_guard_failed',
      guard,
      escalation
    };
    try {
      emitObs({
        action: 'automation_execute',
        result: 'fail',
        lineUserId: payload.lineUserId,
        meta: { reason: response.reason, action: payload.action }
      });
    } catch (emitErr) {
      // best-effort only
    }
    return response;
  }

  if (payload.action === 'NO_ACTION') {
    const response = { ok: false, skipped: true, reason: 'no_action_not_executable', config, guard };
    try {
      emitObs({
        action: 'automation_execute',
        result: 'skip',
        lineUserId: payload.lineUserId,
        meta: { reason: response.reason, action: payload.action }
      });
    } catch (emitErr) {
      // best-effort only
    }
    return response;
  }

  const execution = await executeFn({
    lineUserId: payload.lineUserId,
    decisionLogId: payload.decisionLogId,
    action: payload.action,
    consoleServerTime: payload.consoleServerTime,
    maxConsoleAgeMs: payload.maxConsoleAgeMs
  }, deps);

  const response = {
    ok: true,
    automated: true,
    execution
  };
  try {
    emitObs({
      action: 'automation_execute',
      result: 'ok',
      lineUserId: payload.lineUserId,
      meta: {
        action: payload.action,
        executionResult: execution && execution.result ? execution.result : null
      }
    });
  } catch (emitErr) {
    // best-effort only
  }
  return response;
}

module.exports = {
  executeAutomationDecision
};
