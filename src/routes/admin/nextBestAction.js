'use strict';

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { getNextBestAction } = require('../../usecases/tasks/getNextBestAction');
const { computeNotificationFatigueWarning } = require('../../usecases/notifications/computeNotificationFatigueWarning');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { isUxOsFatigueWarnEnabled } = require('../../domain/tasks/featureFlags');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const NEXT_BEST_ACTION_ROUTE_KEY = 'admin.os_next_best_action';
const FATIGUE_WARNING_ROUTE_KEY = 'admin.os_notification_fatigue_warning';

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

function parseLineUserId(req) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = url.searchParams.get('lineUserId');
  if (typeof lineUserId !== 'string') return '';
  return lineUserId.trim();
}

function parseNotificationCategory(req) {
  const url = new URL(req.url, 'http://localhost');
  const category = url.searchParams.get('notificationCategory');
  if (typeof category !== 'string') return '';
  return category.trim();
}

function parseDailyThreshold(req) {
  const url = new URL(req.url, 'http://localhost');
  const value = url.searchParams.get('dailyThreshold');
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

async function handleNextBestAction(req, res, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const lineUserId = parseLineUserId(req);
  if (!lineUserId) {
    writeJson(res, NEXT_BEST_ACTION_ROUTE_KEY, 400, { ok: false, error: 'lineUserId required', traceId, requestId }, {
      state: 'error',
      reason: 'line_user_id_required'
    });
    return;
  }

  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const compute = typeof resolvedDeps.getNextBestAction === 'function'
    ? resolvedDeps.getNextBestAction
    : getNextBestAction;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;

  try {
    const result = await compute({
      lineUserId,
      actor,
      traceId,
      requestId
    }, resolvedDeps);

    await appendAudit({
      actor,
      action: 'uxos.next_best_action.view',
      entityType: 'user',
      entityId: lineUserId,
      traceId,
      requestId,
      payloadSummary: {
        authority: result && result.authority ? result.authority : null,
        enabled: result && result.enabled === true,
        hasNextBestAction: Boolean(result && result.nextBestAction),
        fallbackReason: result && result.fallbackReason ? result.fallbackReason : null
      }
    });

    writeJson(res, NEXT_BEST_ACTION_ROUTE_KEY, 200, {
      ok: true,
      traceId,
      requestId,
      result
    }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    logRouteError('admin.os_next_best_action', err, { traceId, requestId, actor, lineUserId });
    writeJson(res, NEXT_BEST_ACTION_ROUTE_KEY, 500, { ok: false, error: 'error', traceId, requestId }, {
      state: 'error',
      reason: 'error'
    });
  }
}

async function handleNotificationFatigueWarning(req, res, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const lineUserId = parseLineUserId(req);
  if (!lineUserId) {
    writeJson(res, FATIGUE_WARNING_ROUTE_KEY, 400, { ok: false, error: 'lineUserId required', traceId, requestId }, {
      state: 'error',
      reason: 'line_user_id_required'
    });
    return;
  }

  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  if (!isUxOsFatigueWarnEnabled()) {
    const disabledResult = {
      ok: true,
      enabled: false,
      lineUserId,
      warning: null,
      fallbackReason: 'ENABLE_UXOS_FATIGUE_WARN_V1_off'
    };
    await appendAudit({
      actor,
      action: 'uxos.notification_fatigue_warning.view',
      entityType: 'user',
      entityId: lineUserId,
      traceId,
      requestId,
      payloadSummary: {
        enabled: false,
        fallbackReason: 'ENABLE_UXOS_FATIGUE_WARN_V1_off'
      }
    });
    writeJson(res, FATIGUE_WARNING_ROUTE_KEY, 200, {
      ok: true,
      traceId,
      requestId,
      result: disabledResult
    }, {
      state: 'blocked',
      reason: 'uxos_fatigue_warn_disabled'
    });
    return;
  }

  const compute = typeof resolvedDeps.computeNotificationFatigueWarning === 'function'
    ? resolvedDeps.computeNotificationFatigueWarning
    : computeNotificationFatigueWarning;
  const notificationCategory = parseNotificationCategory(req);
  const dailyThreshold = parseDailyThreshold(req);

  try {
    const warning = await compute({
      lineUserId,
      notificationCategory: notificationCategory || null,
      dailyThreshold,
      now: new Date().toISOString()
    }, resolvedDeps);

    const result = {
      ok: true,
      enabled: true,
      lineUserId,
      warning: warning && typeof warning === 'object' ? warning : null,
      fallbackReason: null
    };

    await appendAudit({
      actor,
      action: 'uxos.notification_fatigue_warning.view',
      entityType: 'user',
      entityId: lineUserId,
      traceId,
      requestId,
      payloadSummary: {
        enabled: true,
        warn: Boolean(warning && warning.warn === true),
        threshold: warning && Number.isFinite(Number(warning.threshold)) ? Number(warning.threshold) : null,
        projectedDeliveredToday: warning && Number.isFinite(Number(warning.projectedDeliveredToday))
          ? Number(warning.projectedDeliveredToday)
          : null,
        notificationCategory: warning && warning.notificationCategory ? warning.notificationCategory : null
      }
    });

    writeJson(res, FATIGUE_WARNING_ROUTE_KEY, 200, {
      ok: true,
      traceId,
      requestId,
      result
    }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    logRouteError('admin.os_notification_fatigue_warning', err, { traceId, requestId, actor, lineUserId });
    writeJson(res, FATIGUE_WARNING_ROUTE_KEY, 500, { ok: false, error: 'error', traceId, requestId }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleNextBestAction,
  handleNotificationFatigueWarning
};
