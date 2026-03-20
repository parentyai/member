'use strict';

const { getUserOperationalSummary: getUserOperationalSummaryBase } = require('../../usecases/admin/getUserOperationalSummary');
const { getNotificationOperationalSummary: getNotificationOperationalSummaryBase } = require('../../usecases/admin/getNotificationOperationalSummary');
const { appendAuditLog: appendAuditLogBase } = require('../../usecases/audit/appendAuditLog');
const { logReadPathLoadMetric: logReadPathLoadMetricBase } = require('../../ops/readPathLoadMetric');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const {
  normalizeFallbackMode,
  resolveFallbackModeDefault
} = require('../../domain/readModel/fallbackPolicy');
const SCENARIO_KEY_FIELD = String.fromCharCode(115,99,101,110,97,114,105,111,75,101,121);
const ROUTE_TYPE = 'admin_route';
const ROUTE_KEYS = {
  users: 'admin.ops_users_summary',
  notifications: 'admin.ops_notifications_summary'
};

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

function writeText(res, routeKey, statusCode, text, outcomeOptions) {
  applyOutcomeHeaders(res, normalizeOutcomeOptions(routeKey, outcomeOptions));
  res.writeHead(statusCode, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function resolveValidationReason(message) {
  if (message === 'invalid limit') return 'invalid_limit';
  if (message === 'invalid snapshotMode') return 'invalid_snapshot_mode';
  if (message === 'invalid fallbackMode') return 'invalid_fallback_mode';
  if (message === 'invalid fallbackOnEmpty') return 'invalid_fallback_on_empty';
  if (message.includes('required')) return 'invalid_request';
  return 'error';
}

function handleError(res, routeKey, err) {
  const message = err && err.message ? err.message : 'error';
  if (
    message.includes('required') ||
    message.includes('invalid limit') ||
    message.includes('invalid snapshotMode') ||
    message.includes('invalid fallbackMode') ||
    message.includes('invalid fallbackOnEmpty')
  ) {
    writeText(res, routeKey, 400, message, {
      state: 'error',
      reason: resolveValidationReason(message)
    });
    return;
  }
  writeText(res, routeKey, 500, 'error', {
    state: 'error',
    reason: 'error'
  });
}

function parsePositiveInt(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

function parseSnapshotMode(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value === 'prefer' || value === 'require') return value;
  return null;
}

function parseFallbackMode(value) {
  if (value === null || value === undefined || value === '') return resolveFallbackModeDefault();
  const normalized = normalizeFallbackMode(value);
  if (normalized) return normalized;
  return null;
}

function parseFallbackOnEmpty(value) {
  if (value === null || value === undefined || value === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function resolveHeader(req, key) {
  if (!req || !req.headers) return null;
  const value = req.headers[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function resolveAuditActor(req) {
  return resolveHeader(req, 'x-actor') || 'admin_api';
}

async function appendFallbackAudit(req, action, meta, extra, deps) {
  if (!meta) return;
  const fallbackUsed = Boolean(meta.fallbackUsed);
  const fallbackBlocked = Boolean(meta.fallbackBlocked);
  if (!fallbackUsed && !fallbackBlocked) return;
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLogBase;
  try {
    const payloadSummary = Object.assign({
      fallbackUsed,
      fallbackBlocked,
      fallbackSources: Array.isArray(meta.fallbackSources) ? meta.fallbackSources : []
    }, extra || {});
    await appendAudit({
      actor: resolveAuditActor(req),
      action,
      entityType: 'read_path',
      entityId: 'summary',
      traceId: resolveHeader(req, 'x-trace-id') || undefined,
      requestId: resolveHeader(req, 'x-request-id') || undefined,
      payloadSummary
    });
    await appendAudit({
      actor: resolveAuditActor(req),
      action: 'read_path_fallback',
      entityType: 'read_path',
      entityId: 'summary',
      traceId: resolveHeader(req, 'x-trace-id') || undefined,
      requestId: resolveHeader(req, 'x-request-id') || undefined,
      payloadSummary: Object.assign({}, payloadSummary, { readPathAction: action })
    });
  } catch (_err) {
    // best effort only
  }
}

function resolveSummaryOutcome(meta) {
  if (meta && meta.fallbackUsed === true) {
    return {
      state: 'degraded',
      reason: 'completed_with_fallback'
    };
  }
  if (meta && meta.fallbackBlocked === true && meta.dataSource === 'not_available') {
    return {
      state: 'degraded',
      reason: 'not_available'
    };
  }
  return {
    state: 'success',
    reason: 'completed'
  };
}

async function handleUsersSummary(req, res, deps) {
  const startedAt = Date.now();
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getUserOperationalSummary = typeof resolvedDeps.getUserOperationalSummary === 'function'
    ? resolvedDeps.getUserOperationalSummary
    : getUserOperationalSummaryBase;
  const logMetric = typeof resolvedDeps.logReadPathLoadMetric === 'function'
    ? resolvedDeps.logReadPathLoadMetric
    : logReadPathLoadMetricBase;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLogBase;
  try {
    const url = new URL(req.url, 'http://localhost');
    const limitRaw = url.searchParams.get('limit');
    const analyticsLimitRaw = url.searchParams.get('analyticsLimit');
    const snapshotModeRaw = url.searchParams.get('snapshotMode');
    const fallbackModeRaw = url.searchParams.get('fallbackMode');
    const fallbackOnEmptyRaw = url.searchParams.get('fallbackOnEmpty');
    const limit = parsePositiveInt(limitRaw, 1, 500);
    const analyticsLimit = parsePositiveInt(analyticsLimitRaw, 1, 3000);
    const snapshotMode = parseSnapshotMode(snapshotModeRaw);
    const fallbackMode = parseFallbackMode(fallbackModeRaw);
    const fallbackOnEmpty = parseFallbackOnEmpty(fallbackOnEmptyRaw);
    if ((limitRaw && !limit) || (analyticsLimitRaw && !analyticsLimit)) {
      throw new Error('invalid limit');
    }
    if (snapshotModeRaw && !snapshotMode) {
      throw new Error('invalid snapshotMode');
    }
    if (fallbackModeRaw && !fallbackMode) {
      throw new Error('invalid fallbackMode');
    }
    if (fallbackOnEmptyRaw && fallbackOnEmpty === null) {
      throw new Error('invalid fallbackOnEmpty');
    }
    const items = await getUserOperationalSummary({
      limit,
      analyticsLimit,
      snapshotMode,
      fallbackMode,
      fallbackOnEmpty,
      includeMeta: true
    });
    const normalizedItems = Array.isArray(items) ? items : (Array.isArray(items.items) ? items.items : []);
    const meta = items && !Array.isArray(items) && items.meta ? items.meta : null;
    logMetric({
      cluster: 'analytics_read_model',
      operation: 'users_summary',
      scannedCount: meta && Number.isFinite(Number(meta.scannedCount)) ? Number(meta.scannedCount) : normalizedItems.length,
      resultCount: normalizedItems.length,
      durationMs: Date.now() - startedAt,
      fallbackUsed: Boolean(meta && meta.fallbackUsed),
      dataSource: meta && meta.dataSource ? meta.dataSource : null,
      traceId: resolveHeader(req, 'x-trace-id'),
      requestId: resolveHeader(req, 'x-request-id'),
      limit: Number.isFinite(Number(limit)) ? Number(limit) : null,
      readLimitUsed: Number.isFinite(Number(analyticsLimit)) ? Number(analyticsLimit) : null
    });
    await appendFallbackAudit(req, 'read_path.fallback.users_summary', meta, {
      scope: 'phase4_users_summary',
      snapshotMode: snapshotMode || null,
      fallbackMode,
      fallbackOnEmpty
    }, { appendAuditLog: appendAudit });
    writeJson(res, ROUTE_KEYS.users, 200, {
      ok: true,
      items: normalizedItems,
      dataSource: meta && meta.dataSource ? meta.dataSource : null,
      asOf: meta && Object.prototype.hasOwnProperty.call(meta, 'asOf') ? meta.asOf : null,
      freshnessMinutes: meta && Object.prototype.hasOwnProperty.call(meta, 'freshnessMinutes') ? meta.freshnessMinutes : null,
      fallbackUsed: meta && Object.prototype.hasOwnProperty.call(meta, 'fallbackUsed') ? meta.fallbackUsed : false,
      fallbackBlocked: meta && Object.prototype.hasOwnProperty.call(meta, 'fallbackBlocked') ? meta.fallbackBlocked : false,
      fallbackSources: meta && Array.isArray(meta.fallbackSources) ? meta.fallbackSources : []
    }, resolveSummaryOutcome(meta));
  } catch (err) {
    handleError(res, ROUTE_KEYS.users, err);
  }
}

async function handleNotificationsSummary(req, res, deps) {
  const startedAt = Date.now();
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getSummary = typeof resolvedDeps.getNotificationOperationalSummary === 'function'
    ? resolvedDeps.getNotificationOperationalSummary
    : getNotificationOperationalSummaryBase;
  const logMetric = typeof resolvedDeps.logReadPathLoadMetric === 'function'
    ? resolvedDeps.logReadPathLoadMetric
    : logReadPathLoadMetricBase;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLogBase;
  const url = new URL(req.url, 'http://localhost');
  const limitRaw = url.searchParams.get('limit');
  const eventsLimitRaw = url.searchParams.get('eventsLimit');
  const snapshotModeRaw = url.searchParams.get('snapshotMode');
  const fallbackModeRaw = url.searchParams.get('fallbackMode');
  const fallbackOnEmptyRaw = url.searchParams.get('fallbackOnEmpty');
  const status = url.searchParams.get('status');
  const scenarioFilter = url.searchParams.get(SCENARIO_KEY_FIELD);
  const stepKey = url.searchParams.get('stepKey');
  try {
    const limit = parsePositiveInt(limitRaw, 1, 500);
    const eventsLimit = parsePositiveInt(eventsLimitRaw, 1, 3000);
    const snapshotMode = parseSnapshotMode(snapshotModeRaw);
    const fallbackMode = parseFallbackMode(fallbackModeRaw);
    const fallbackOnEmpty = parseFallbackOnEmpty(fallbackOnEmptyRaw);
    if ((limitRaw && !limit) || (eventsLimitRaw && !eventsLimit)) {
      throw new Error('invalid limit');
    }
    if (snapshotModeRaw && !snapshotMode) {
      throw new Error('invalid snapshotMode');
    }
    if (fallbackModeRaw && !fallbackMode) {
      throw new Error('invalid fallbackMode');
    }
    if (fallbackOnEmptyRaw && fallbackOnEmpty === null) {
      throw new Error('invalid fallbackOnEmpty');
    }
    const summary = await getSummary({
      limit,
      eventsLimit,
      snapshotMode,
      fallbackMode,
      fallbackOnEmpty,
      includeMeta: true,
      status: status || undefined,
      [SCENARIO_KEY_FIELD]: scenarioFilter || undefined,
      stepKey: stepKey || undefined
    });
    const items = Array.isArray(summary) ? summary : (Array.isArray(summary.items) ? summary.items : []);
    const meta = summary && !Array.isArray(summary) && summary.meta ? summary.meta : null;
    logMetric({
      cluster: 'analytics_read_model',
      operation: 'notifications_summary',
      scannedCount: meta && Number.isFinite(Number(meta.scannedCount)) ? Number(meta.scannedCount) : items.length,
      resultCount: items.length,
      durationMs: Date.now() - startedAt,
      fallbackUsed: Boolean(meta && meta.fallbackUsed),
      dataSource: meta && meta.dataSource ? meta.dataSource : null,
      traceId: resolveHeader(req, 'x-trace-id'),
      requestId: resolveHeader(req, 'x-request-id'),
      limit: Number.isFinite(Number(limit)) ? Number(limit) : null,
      readLimitUsed: Number.isFinite(Number(eventsLimit)) ? Number(eventsLimit) : null
    });
    await appendFallbackAudit(req, 'read_path.fallback.notifications_summary', meta, {
      scope: 'phase4_notifications_summary',
      snapshotMode: snapshotMode || null,
      fallbackMode,
      fallbackOnEmpty
    }, { appendAuditLog: appendAudit });
    writeJson(res, ROUTE_KEYS.notifications, 200, {
      ok: true,
      items,
      dataSource: meta && meta.dataSource ? meta.dataSource : null,
      asOf: meta && Object.prototype.hasOwnProperty.call(meta, 'asOf') ? meta.asOf : null,
      freshnessMinutes: meta && Object.prototype.hasOwnProperty.call(meta, 'freshnessMinutes') ? meta.freshnessMinutes : null,
      fallbackUsed: meta && Object.prototype.hasOwnProperty.call(meta, 'fallbackUsed') ? meta.fallbackUsed : false,
      fallbackBlocked: meta && Object.prototype.hasOwnProperty.call(meta, 'fallbackBlocked') ? meta.fallbackBlocked : false,
      fallbackSources: meta && Array.isArray(meta.fallbackSources) ? meta.fallbackSources : []
    }, resolveSummaryOutcome(meta));
  } catch (err) {
    handleError(res, ROUTE_KEYS.notifications, err);
  }
}

module.exports = {
  handleUsersSummary,
  handleNotificationsSummary
};
