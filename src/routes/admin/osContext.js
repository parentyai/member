'use strict';

const crypto = require('crypto');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');

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

module.exports = {
  resolveActor,
  requireActor,
  resolveRequestId,
  resolveTraceId,
  parseJson,
  logRouteError
};
