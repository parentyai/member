'use strict';

const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, parseJson, logRouteError } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.os_view';

const SCREEN_TO_ACTION = Object.freeze({
  composer: 'admin_os.composer.view',
  monitor: 'admin_os.monitor.view',
  errors: 'admin_os.errors.view',
  master: 'admin_os.master.view'
});

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

async function handleView(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const screen = typeof payload.screen === 'string' ? payload.screen.trim() : '';
  const action = SCREEN_TO_ACTION[screen] || null;
  if (!action) {
    writeJson(res, 400, { ok: false, error: 'invalid screen', traceId, requestId }, {
      state: 'error',
      reason: 'invalid_screen'
    });
    return;
  }

  try {
    await appendAuditLog({
      actor,
      action,
      entityType: 'admin_os',
      entityId: screen,
      traceId,
      requestId,
      payloadSummary: { screen }
    });

    writeJson(res, 200, {
      ok: true,
      serverTime: new Date().toISOString(),
      traceId,
      requestId,
      screen,
      action
    }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    logRouteError(ROUTE_KEY, err, { traceId, requestId, actor });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleView
};
