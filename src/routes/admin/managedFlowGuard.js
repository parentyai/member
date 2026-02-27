'use strict';

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { getManagedFlowRegistry } = require('../../domain/managedFlowRegistry');
const { resolveActionByMethodAndPath } = require('./managedFlowBindings');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readHeader(req, key) {
  const value = req && req.headers ? req.headers[key] : null;
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePayload(input) {
  return input && typeof input === 'object' ? input : {};
}

function resolvePathname(req) {
  try {
    return new URL(req && req.url ? req.url : '/', 'http://localhost').pathname;
  } catch (_err) {
    return '/';
  }
}

function buildFallbackTraceId(req) {
  const requestId = readHeader(req, 'x-request-id');
  if (requestId) return requestId;
  return `managed_flow_trace_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

async function auditManagedFlowViolation(entry, deps) {
  const append = deps && typeof deps.appendAuditLog === 'function' ? deps.appendAuditLog : appendAuditLog;
  try {
    await append(Object.assign({
      actor: entry.actor || 'unknown',
      action: 'managed_flow.guard.violation',
      entityType: 'managed_flow',
      entityId: entry.actionKey || 'unknown'
    }, entry));
  } catch (_err) {
    // best effort
  }
}

async function auditManagedFlowWarning(entry, deps) {
  const append = deps && typeof deps.appendAuditLog === 'function' ? deps.appendAuditLog : appendAuditLog;
  try {
    await append(Object.assign({
      actor: entry.actor || 'unknown',
      action: 'managed_flow.guard.warning',
      entityType: 'managed_flow',
      entityId: entry.actionKey || 'unknown'
    }, entry));
  } catch (_err) {
    // best effort
  }
}

async function enforceManagedFlowGuard(params, deps) {
  const input = params && typeof params === 'object' ? params : {};
  const req = input.req;
  const res = input.res;
  const actionKey = typeof input.actionKey === 'string' ? input.actionKey.trim() : '';
  if (!actionKey) {
    writeJson(res, 500, { ok: false, error: 'managed_flow_action_key_required' });
    return null;
  }

  let registry;
  try {
    registry = getManagedFlowRegistry();
  } catch (err) {
    const message = err && err.message ? err.message : 'registry_invalid';
    writeJson(res, 503, { ok: false, error: 'managed_flow_registry_invalid', detail: message });
    return null;
  }

  const actionDef = registry.actionByKey[actionKey];
  if (!actionDef) {
    writeJson(res, 500, { ok: false, error: 'managed_flow_action_not_defined', actionKey });
    return null;
  }
  const resolvedBinding = resolveActionByMethodAndPath(req && req.method, resolvePathname(req));
  if (resolvedBinding && resolvedBinding.actionKey !== actionKey) {
    writeJson(res, 500, {
      ok: false,
      error: 'managed_flow_action_mismatch',
      actionKey,
      resolvedActionKey: resolvedBinding.actionKey
    });
    return null;
  }
  const flow = registry.flowById[actionDef.flowId];
  if (!flow) {
    writeJson(res, 500, { ok: false, error: 'managed_flow_not_defined', flowId: actionDef.flowId });
    return null;
  }

  let traceId = readHeader(req, 'x-trace-id');
  const actorHeader = readHeader(req, 'x-actor');
  const payload = normalizePayload(input.payload);

  if (flow.guardRules.traceMode === 'required' && !traceId) {
    if (flow.guardRules.actorMode === 'allow_fallback') {
      traceId = buildFallbackTraceId(req);
      await auditManagedFlowWarning({
        actor: actorHeader || 'unknown',
        actionKey,
        traceId,
        payloadSummary: {
          reason: 'trace_fallback'
        }
      }, deps);
    } else {
      await auditManagedFlowViolation({
        actionKey,
        traceId: null,
        payloadSummary: {
          reason: 'trace_required'
        }
      }, deps);
      writeJson(res, 400, { ok: false, error: 'x-trace-id required' });
      return null;
    }
  }

  let actor = actorHeader;
  if (flow.guardRules.actorMode === 'required' && !actor) {
    await auditManagedFlowViolation({
      actionKey,
      traceId: traceId || null,
      payloadSummary: {
        reason: 'actor_required'
      }
    }, deps);
    writeJson(res, 400, { ok: false, error: 'x-actor required', traceId: traceId || null });
    return null;
  }

  if (flow.guardRules.actorMode === 'allow_fallback' && !actor) {
    actor = 'unknown';
    await auditManagedFlowWarning({
      actor,
      actionKey,
      traceId: traceId || null,
      payloadSummary: {
        reason: 'actor_fallback'
      }
    }, deps);
  }

  const confirmMode = typeof flow.confirmMode === 'string' && flow.confirmMode
    ? flow.confirmMode
    : (flow.guardRules.confirmMode === 'required' ? 'required' : 'warn_only');
  const planHash = typeof payload.planHash === 'string' ? payload.planHash.trim() : '';
  const confirmToken = typeof payload.confirmToken === 'string' ? payload.confirmToken.trim() : '';
  if (!planHash || !confirmToken) {
    if (confirmMode === 'required') {
      await auditManagedFlowViolation({
        actor: actor || 'unknown',
        actionKey,
        traceId: traceId || null,
        payloadSummary: {
          reason: 'confirm_required'
        }
      }, deps);
      writeJson(res, 400, { ok: false, error: 'planHash/confirmToken required', traceId: traceId || null });
      return null;
    }
    if (confirmMode === 'warn_only') {
      await auditManagedFlowWarning({
        actor: actor || 'unknown',
        actionKey,
        traceId: traceId || null,
        payloadSummary: {
          reason: 'confirm_missing_warn_only'
        }
      }, deps);
    }
  }

  if (flow.guardRules.killSwitchCheck === 'required' && payload.killSwitchChecked !== true) {
    await auditManagedFlowViolation({
      actor: actor || 'unknown',
      actionKey,
      traceId: traceId || null,
      payloadSummary: {
        reason: 'kill_switch_check_required'
      }
    }, deps);
    writeJson(res, 409, { ok: false, error: 'kill_switch_check_required', traceId: traceId || null });
    return null;
  }

  return {
    ok: true,
    flowId: flow.flowId,
    actionKey,
    actor: actor || 'unknown',
    traceId: traceId || null,
    confirmMode,
    guardRules: flow.guardRules
  };
}

module.exports = {
  enforceManagedFlowGuard,
  auditManagedFlowViolation,
  auditManagedFlowWarning
};
