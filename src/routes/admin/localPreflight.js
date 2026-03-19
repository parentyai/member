'use strict';

const { runLocalPreflight } = require('../../../tools/admin_local_preflight');
const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
  logRouteError
} = require('./osContext');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.local_preflight';

function normalizeOutcomeOptions(outcomeOptions) {
  const input = outcomeOptions && typeof outcomeOptions === 'object' ? outcomeOptions : {};
  const guard = input.guard && typeof input.guard === 'object' ? input.guard : {};
  return Object.assign({}, input, {
    routeType: ROUTE_TYPE,
    guard: Object.assign({}, guard, { routeKey: ROUTE_KEY })
  });
}

function writeJson(res, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleLocalPreflight(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  try {
    const result = await runLocalPreflight({
      env: process.env,
      allowGcloudProjectIdDetect: true
    });
    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      actor,
      ready: result.ready === true,
      checkedAt: result.checkedAt || null,
      checks: result.checks || {},
      summary: result.summary || null
    }, {
      state: result.ready === true ? 'success' : 'degraded',
      reason: result.ready === true ? 'completed' : 'not_ready'
    });
  } catch (err) {
    logRouteError('admin.local_preflight', err, { actor, traceId, requestId });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleLocalPreflight
};
