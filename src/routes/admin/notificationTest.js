'use strict';

const { runNotificationTest } = require('../../usecases/notifications/runNotificationTest');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { resolveActor, resolveRequestId, resolveTraceId, parseJson } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const SEND_TEST_ROUTE_KEY = 'admin.notification_test_send';
const TEST_RUNS_ROUTE_KEY = 'admin.notification_test_runs';

function normalizeOutcomeOptions(routeKey, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = routeKey;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, routeKey, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(routeKey, outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function handleError(res, routeKey, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('invalid')) {
    writeJson(res, routeKey, 400, { ok: false, error: message }, {
      state: 'error',
      reason: `${String(message).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'invalid_request'}`
    });
    return;
  }
  writeJson(res, routeKey, 500, { ok: false, error: 'error' }, {
    state: 'error',
    reason: 'error'
  });
}

async function handleSendTest(req, res, body, deps) {
  const payload = parseJson(body, res);
  if (!payload) return;
  const notificationId = payload.notificationId;
  if (!notificationId) {
    writeJson(res, SEND_TEST_ROUTE_KEY, 400, { ok: false, error: 'notificationId required' }, {
      state: 'error',
      reason: 'notification_id_required'
    });
    return;
  }
  const mode = payload.mode === 'dry_run' ? 'dry_run' : 'self_send';
  if (mode === 'self_send' && !payload.lineUserId) {
    writeJson(res, SEND_TEST_ROUTE_KEY, 400, { ok: false, error: 'lineUserId required' }, {
      state: 'error',
      reason: 'line_user_id_required'
    });
    return;
  }
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const actor = resolveActor(req);
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const runTest = typeof resolvedDeps.runNotificationTest === 'function'
    ? resolvedDeps.runNotificationTest
    : runNotificationTest;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  try {
    const result = await runTest({
      mode,
      notificationId,
      lineUserId: payload.lineUserId || null,
      traceId,
      requestId,
      actor,
      persist: true,
      useRegistry: false
    });
    try {
      await appendAudit({
        actor,
        action: 'notifications.test_run',
        entityType: 'notification',
        entityId: notificationId,
        traceId,
        requestId,
        payloadSummary: {
          mode,
          notificationId,
          runId: result.runId,
          ok: result.ok
        }
      });
    } catch (_err) {
      // best-effort only
    }
    writeJson(res, SEND_TEST_ROUTE_KEY, 200, {
      ok: true,
      runId: result.runId,
      traceId,
      summary: result.summary,
      results: result.results
    }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    handleError(res, SEND_TEST_ROUTE_KEY, err);
  }
}

async function handleTestRuns(req, res, body, deps) {
  const payload = parseJson(body, res);
  if (!payload) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const actor = resolveActor(req);
  const mode = payload.mode === 'self_send' ? 'self_send' : 'dry_run';
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const runTest = typeof resolvedDeps.runNotificationTest === 'function'
    ? resolvedDeps.runNotificationTest
    : runNotificationTest;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  try {
    const result = await runTest({
      mode,
      patterns: Array.isArray(payload.patterns) ? payload.patterns : null,
      useRegistry: payload.useRegistry !== false,
      lineUserId: payload.lineUserId || null,
      traceId,
      requestId,
      actor,
      persist: true
    });
    try {
      await appendAudit({
        actor,
        action: 'notifications.test_run.batch',
        entityType: 'notification_test',
        entityId: result.runId,
        traceId,
        requestId,
        payloadSummary: {
          mode,
          runId: result.runId,
          total: result.summary.total,
          failed: result.summary.failed
        }
      });
    } catch (_err) {
      // best-effort only
    }
    writeJson(res, TEST_RUNS_ROUTE_KEY, 200, {
      ok: true,
      runId: result.runId,
      traceId,
      summary: result.summary
    }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    handleError(res, TEST_RUNS_ROUTE_KEY, err);
  }
}

module.exports = {
  handleSendTest,
  handleTestRuns
};
