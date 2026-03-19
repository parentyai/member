'use strict';

const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { getTraceBundle } = require('../../usecases/admin/getTraceBundle');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { logRouteError } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.trace_search';

function resolveActor(req) {
  const actor = req && req.headers && req.headers['x-actor'];
  if (typeof actor === 'string' && actor.trim().length > 0) return actor.trim();
  return 'unknown';
}

function resolveRequestId(req) {
  const headerId = req && req.headers && req.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.length > 0) return headerId;
  const trace = req && req.headers && req.headers['x-cloud-trace-context'];
  if (typeof trace === 'string' && trace.length > 0) return trace.split('/')[0];
  return 'unknown';
}

function normalizeOutcomeOptions(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = ROUTE_KEY;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function handleError(res, err, context) {
  const message = err && err.message ? err.message : 'error';
  const meta = context && typeof context === 'object' ? context : {};
  if (message.includes('required') || message.includes('invalid')) {
    writeJson(res, 400, {
      ok: false,
      error: message,
      traceId: meta.traceId || null,
      requestId: meta.requestId || 'unknown'
    }, {
      state: 'error',
      reason: 'invalid_request'
    });
    return;
  }
  logRouteError(ROUTE_KEY, err, {
    actor: meta.actor || 'unknown',
    traceId: meta.traceId || null,
    requestId: meta.requestId || 'unknown'
  });
  writeJson(res, 500, {
    ok: false,
    error: 'error',
    traceId: meta.traceId || null,
    requestId: meta.requestId || 'unknown'
  }, {
    state: 'error',
    reason: 'error'
  });
}

async function handleAdminTraceSearch(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const traceId = url.searchParams.get('traceId');
  const limit = url.searchParams.get('limit');
  const actor = resolveActor(req);
  const requestId = resolveRequestId(req);
  const startedAt = Date.now();
  try {
    const result = await getTraceBundle({ traceId, limit });
    const summary = result && result.traceJoinSummary && typeof result.traceJoinSummary === 'object'
      ? result.traceJoinSummary
      : {};
    const completedAt = Date.now();
    try {
      await appendAuditLog({
        actor,
        action: 'trace_search.view',
        entityType: 'trace',
        entityId: traceId || 'unknown',
        traceId,
        requestId,
        payloadSummary: {
          traceId,
          limit: limit || null,
          traceJoinCompleteness: Number.isFinite(Number(summary.completeness)) ? Number(summary.completeness) : null,
          joinedDomains: Array.isArray(summary.joinedDomains) ? summary.joinedDomains.slice(0, 8) : [],
          missingDomains: Array.isArray(summary.missingDomains) ? summary.missingDomains.slice(0, 8) : [],
          joinedDomainCount: Array.isArray(summary.joinedDomains) ? summary.joinedDomains.length : 0,
          missingDomainCount: Array.isArray(summary.missingDomains) ? summary.missingDomains.length : 0,
          traceBundleLoadMs: Math.max(0, completedAt - startedAt)
        }
      });
    } catch (_err) {
      // best-effort only
    }
    writeJson(res, 200, result, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    handleError(res, err, { actor, traceId, requestId });
  }
}

module.exports = {
  handleAdminTraceSearch
};
