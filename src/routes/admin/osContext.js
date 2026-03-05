'use strict';

const crypto = require('crypto');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { getPublicWriteSafetySnapshot } = require('../../repos/firestore/systemFlagsRepo');

function resolveActor(req) {
  const actor = req && req.headers && req.headers['x-actor'];
  if (typeof actor === 'string' && actor.trim().length > 0) return actor.trim();
  return 'unknown';
}

function requireActor(req, res) {
  const actor = resolveActor(req);
  if (actor === 'unknown') {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'x-actor required' }));
    return null;
  }
  return actor;
}

function resolveRequestId(req) {
  const headerId = req && req.headers && req.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.length > 0) return headerId;
  const trace = req && req.headers && req.headers['x-cloud-trace-context'];
  if (typeof trace === 'string' && trace.length > 0) return trace.split('/')[0];
  return 'unknown';
}

function resolveTraceId(req) {
  const headerId = req && req.headers && req.headers['x-trace-id'];
  if (typeof headerId === 'string' && headerId.trim().length > 0) return headerId.trim();
  const requestId = resolveRequestId(req);
  if (requestId && requestId !== 'unknown') return requestId;
  return crypto.randomUUID();
}

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (_err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

function sanitizeLogToken(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, '_').slice(0, 512);
}

function logRouteError(routeId, err, context) {
  const route = sanitizeLogToken(routeId || 'unknown');
  const traceId = sanitizeLogToken(context && context.traceId ? context.traceId : '');
  const requestId = sanitizeLogToken(context && context.requestId ? context.requestId : '');
  const actor = sanitizeLogToken(context && context.actor ? context.actor : '');
  const name = sanitizeLogToken(err && err.name ? err.name : 'Error');
  const message = sanitizeLogToken(err && err.message ? err.message : 'error');
  const parts = [`[route_error] route=${route}`, `name=${name}`, `message=${message}`];
  if (traceId) parts.push(`traceId=${traceId}`);
  if (requestId) parts.push(`requestId=${requestId}`);
  if (actor) parts.push(`actor=${actor}`);
  console.error(parts.join(' '));
  void appendAuditLog({
    actor: actor || 'unknown',
    action: 'route_error',
    entityType: 'route',
    entityId: route,
    traceId: traceId || null,
    requestId: requestId || null,
    payloadSummary: {
      route,
      name,
      message
    }
  }).catch(() => {});
}

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload || {}));
}

function normalizeRouteKey(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

async function appendKillSwitchAuditBestEffort(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const auditFn = deps && typeof deps.appendAuditLog === 'function' ? deps.appendAuditLog : appendAuditLog;
  const routeKey = normalizeRouteKey(payload.routeKey) || 'llm_generation';
  const traceId = payload.traceId || null;
  const requestId = payload.requestId || null;
  const actor = payload.actor || 'unknown';
  const action = payload.action || 'llm_generation.blocked';
  const reason = payload.reason || 'unknown';
  const failCloseMode = payload.failCloseMode || null;
  await auditFn({
    actor,
    action,
    entityType: 'llm_generation',
    entityId: routeKey,
    traceId,
    requestId,
    payloadSummary: {
      routeKey,
      reason,
      failCloseMode
    }
  }).catch(() => null);
}

async function enforceLlmGenerationKillSwitch(req, res, options, deps) {
  const payload = options && typeof options === 'object' ? options : {};
  const routeKey = normalizeRouteKey(payload.routeKey) || 'llm_generation';
  const actor = payload.actor || resolveActor(req) || 'unknown';
  const traceId = payload.traceId || resolveTraceId(req);
  const requestId = payload.requestId || resolveRequestId(req);
  const getSnapshot = deps && typeof deps.getPublicWriteSafetySnapshot === 'function'
    ? deps.getPublicWriteSafetySnapshot
    : getPublicWriteSafetySnapshot;
  const snapshot = await getSnapshot(routeKey);

  if (snapshot && snapshot.readError === true && snapshot.failCloseMode === 'enforce') {
    await appendKillSwitchAuditBestEffort({
      actor,
      routeKey,
      traceId,
      requestId,
      action: 'llm_generation.blocked',
      reason: 'kill_switch_read_failed_fail_closed',
      failCloseMode: snapshot.failCloseMode || null
    }, deps);
    writeJson(res, 503, {
      ok: false,
      error: 'temporarily unavailable',
      reason: 'kill_switch_read_failed_fail_closed',
      traceId,
      requestId
    });
    return false;
  }

  if (snapshot && snapshot.readError === true && snapshot.failCloseMode === 'warn') {
    await appendKillSwitchAuditBestEffort({
      actor,
      routeKey,
      traceId,
      requestId,
      action: 'llm_generation.guard_warn',
      reason: 'kill_switch_read_failed_fail_open',
      failCloseMode: snapshot.failCloseMode || null
    }, deps);
  }

  if (snapshot && snapshot.killSwitchOn === true) {
    await appendKillSwitchAuditBestEffort({
      actor,
      routeKey,
      traceId,
      requestId,
      action: 'llm_generation.blocked',
      reason: 'kill_switch_on',
      failCloseMode: snapshot.failCloseMode || null
    }, deps);
    writeJson(res, 409, { ok: false, error: 'kill switch on', traceId, requestId });
    return false;
  }

  return true;
}

module.exports = {
  resolveActor,
  requireActor,
  resolveRequestId,
  resolveTraceId,
  parseJson,
  logRouteError,
  enforceLlmGenerationKillSwitch
};
