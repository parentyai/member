'use strict';

const automationConfigRepo = require('../../repos/firestore/automationConfigRepo');
const { getOpsConsole } = require('../phase25/getOpsConsole');

const DEFAULT_CONFIG = {
  enabled: false,
  allowedActions: [],
  requireConfirmation: true
};

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
  return {
    enabled: Boolean(config.enabled),
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

  if (!config.enabled) {
    return { ok: false, dryRun: true, skipped: true, reason: 'automation_disabled', config, guard };
  }
  if (config.requireConfirmation && !payload.confirmed) {
    return { ok: false, dryRun: true, skipped: true, reason: 'confirmation_required', config, guard };
  }
  if (config.allowedActions.length && !config.allowedActions.includes(payload.action)) {
    return { ok: false, dryRun: true, skipped: true, reason: 'action_not_allowed', config, guard };
  }

  return {
    ok: guard.ok,
    dryRun: true,
    skipped: !guard.ok,
    reason: guard.ok ? null : 'automation_guard_failed',
    config,
    guard
  };
}

module.exports = {
  dryRunAutomationDecision
};
