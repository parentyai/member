'use strict';

const automationConfigRepo = require('../../repos/firestore/automationConfigRepo');
const { getOpsConsole } = require('../phase25/getOpsConsole');
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

async function dryRunAutomationDecision(params, deps) {
  const payload = params || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');
  if (!payload.action) throw new Error('action required');
  if (!payload.decisionLogId) throw new Error('decisionLogId required');

  const configRepo = deps && deps.automationConfigRepo ? deps.automationConfigRepo : automationConfigRepo;
  const consoleFn = deps && deps.getOpsConsole ? deps.getOpsConsole : getOpsConsole;

  const storedConfig = await configRepo.getLatestAutomationConfig();
  const config = resolveConfig(storedConfig);

  const consoleResult = await consoleFn({ lineUserId: payload.lineUserId }, deps);
  const guard = evaluateAutomationGuard({
    readiness: consoleResult ? consoleResult.readiness : null,
    consistency: consoleResult ? consoleResult.consistency : null,
    opsState: consoleResult ? consoleResult.opsState : null,
    nowMs: typeof payload.nowMs === 'number' ? payload.nowMs : Date.now(),
    maxOpsStateAgeMs: payload.maxOpsStateAgeMs
  });

  if (config.mode === 'OFF') {
    const response = { ok: false, dryRun: true, skipped: true, reason: 'automation_disabled', config, guard };
    try {
      emitObs({
        action: 'automation_dry_run',
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
    const response = { ok: false, dryRun: true, skipped: true, reason: 'confirmation_required', config, guard };
    try {
      emitObs({
        action: 'automation_dry_run',
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
    const response = { ok: false, dryRun: true, skipped: true, reason: 'action_not_allowed', config, guard };
    try {
      emitObs({
        action: 'automation_dry_run',
        result: 'skip',
        lineUserId: payload.lineUserId,
        meta: { reason: response.reason, action: payload.action }
      });
    } catch (err) {
      // best-effort only
    }
    return response;
  }

  const response = {
    ok: guard.ok,
    dryRun: true,
    skipped: !guard.ok,
    reason: guard.ok ? null : 'automation_guard_failed',
    config,
    guard
  };
  try {
    emitObs({
      action: 'automation_dry_run',
      result: response.ok ? 'ok' : 'fail',
      lineUserId: payload.lineUserId,
      meta: { reason: response.reason, action: payload.action }
    });
  } catch (err) {
    // best-effort only
  }
  return response;
}

module.exports = {
  dryRunAutomationDecision
};
