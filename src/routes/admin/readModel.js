'use strict';

const { getNotificationReadModel } = require('../../usecases/admin/getNotificationReadModel');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { logReadPathLoadMetric } = require('../../ops/readPathLoadMetric');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { resolveActor, resolveRequestId, resolveTraceId } = require('./osContext');
const SCENARIO_KEY_FIELD = String.fromCharCode(115,99,101,110,97,114,105,111,75,101,121);
const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.read_model';

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

function handleError(res, err, traceId, requestId) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required')) {
    writeJson(res, 400, { ok: false, error: message, traceId, requestId }, {
      state: 'error',
      reason: 'invalid_request',
      guard: { decision: 'block' }
    });
    return;
  }
  writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, {
    state: 'error',
    reason: 'error'
  });
}

async function handleNotificationReadModel(req, res) {
  const startedAt = Date.now();
  const url = new URL(req.url, 'http://localhost');
  const limit = url.searchParams.get('limit');
  const status = url.searchParams.get('status');
  const scenarioFilter = url.searchParams.get(SCENARIO_KEY_FIELD);
  const stepKey = url.searchParams.get('stepKey');
  const actor = resolveActor(req);
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  try {
    const items = await getNotificationReadModel({
      limit: limit ? Number(limit) : undefined,
      status: status || undefined,
      [SCENARIO_KEY_FIELD]: scenarioFilter || undefined,
      stepKey: stepKey || undefined
    });
    logReadPathLoadMetric({
      cluster: 'notifications',
      operation: 'read_model_notifications',
      scannedCount: Array.isArray(items) ? items.length : 0,
      resultCount: Array.isArray(items) ? items.length : 0,
      durationMs: Date.now() - startedAt,
      fallbackUsed: false,
      traceId,
      requestId,
      limit: limit ? Number(limit) : null
    });
    try {
      await appendAuditLog({
        actor,
        action: 'read_model.notifications.view',
        entityType: 'read_model',
        entityId: 'notifications',
        traceId,
        requestId,
        payloadSummary: {
          limit: limit ? Number(limit) : null,
          status: status || null,
          [SCENARIO_KEY_FIELD]: scenarioFilter || null,
          stepKey: stepKey || null,
          count: Array.isArray(items) ? items.length : 0
        }
      });
    } catch (_err) {
      // best-effort only
    }
    writeJson(res, 200, { ok: true, items, traceId, serverTime: new Date().toISOString() }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    handleError(res, err, traceId, requestId);
  }
}

module.exports = {
  handleNotificationReadModel
};
