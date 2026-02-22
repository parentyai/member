'use strict';

const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
  logRouteError
} = require('./osContext');

const READ_PATH_FALLBACK_ACTIONS = Object.freeze([
  'read_path.fallback.users_summary',
  'read_path.fallback.notifications_summary',
  'read_path.fallback.phase5_state',
  'read_path.fallback.dashboard_kpi',
  'read_path.fallback.monitor_insights'
]);

const ACTION_ENDPOINT_MAP = Object.freeze({
  'read_path.fallback.users_summary': '/api/phase4/admin/users-summary | /api/phase5/ops/users-summary',
  'read_path.fallback.notifications_summary': '/api/phase4/admin/notifications-summary | /api/phase5/ops/notifications-summary',
  'read_path.fallback.phase5_state': '/api/phase5/state/summary',
  'read_path.fallback.dashboard_kpi': '/api/admin/os/dashboard/kpi',
  'read_path.fallback.monitor_insights': '/api/admin/monitor-insights'
});

function parseLimit(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('limit'));
  if (!Number.isFinite(raw) || raw <= 0) return 20;
  return Math.min(Math.floor(raw), 200);
}

function parseWindowHours(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('windowHours'));
  if (!Number.isFinite(raw) || raw <= 0) return 24;
  return Math.min(Math.floor(raw), 24 * 30);
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function normalizeFallbackRow(row) {
  const payload = row && row.payloadSummary && typeof row.payloadSummary === 'object'
    ? row.payloadSummary
    : {};
  return {
    id: row.id,
    action: row.action || null,
    endpoint: ACTION_ENDPOINT_MAP[row.action] || null,
    actor: row.actor || 'unknown',
    traceId: row.traceId || null,
    requestId: row.requestId || null,
    createdAt: row.createdAt || null,
    fallbackUsed: payload.fallbackUsed === true,
    fallbackBlocked: payload.fallbackBlocked === true,
    fallbackSources: Array.isArray(payload.fallbackSources) ? payload.fallbackSources : []
  };
}

function aggregateByAction(rows, limit) {
  const map = new Map();
  rows.forEach((row) => {
    const action = row && row.action ? row.action : 'unknown';
    const current = map.get(action) || {
      action,
      endpoint: ACTION_ENDPOINT_MAP[action] || null,
      count: 0,
      fallbackUsedCount: 0,
      fallbackBlockedCount: 0,
      fallbackSources: new Set(),
      latestCreatedAt: null,
      latestTraceId: null,
      latestRequestId: null
    };
    current.count += 1;
    if (row.fallbackUsed) current.fallbackUsedCount += 1;
    if (row.fallbackBlocked) current.fallbackBlockedCount += 1;
    (row.fallbackSources || []).forEach((source) => {
      if (source) current.fallbackSources.add(source);
    });
    const rowMs = toMillis(row.createdAt);
    const latestMs = toMillis(current.latestCreatedAt);
    if (!current.latestCreatedAt || rowMs > latestMs) {
      current.latestCreatedAt = row.createdAt || null;
      current.latestTraceId = row.traceId || null;
      current.latestRequestId = row.requestId || null;
    }
    map.set(action, current);
  });

  return Array.from(map.values())
    .sort((a, b) => {
      const byCount = Number(b.count || 0) - Number(a.count || 0);
      if (byCount !== 0) return byCount;
      return toMillis(b.latestCreatedAt) - toMillis(a.latestCreatedAt);
    })
    .slice(0, limit)
    .map((item) => ({
      action: item.action,
      endpoint: item.endpoint,
      count: item.count,
      fallbackUsedCount: item.fallbackUsedCount,
      fallbackBlockedCount: item.fallbackBlockedCount,
      fallbackSources: Array.from(item.fallbackSources.values()).sort(),
      latestCreatedAt: item.latestCreatedAt,
      latestTraceId: item.latestTraceId,
      latestRequestId: item.latestRequestId
    }));
}

async function listFallbackRows(limit, windowHours) {
  const perActionLimit = Math.max(limit * 3, 50);
  const grouped = await Promise.all(READ_PATH_FALLBACK_ACTIONS.map((action) => auditLogsRepo.listAuditLogs({
    action,
    limit: perActionLimit
  })));
  const sinceMs = Date.now() - (windowHours * 60 * 60 * 1000);
  return grouped
    .flat()
    .map(normalizeFallbackRow)
    .filter((row) => READ_PATH_FALLBACK_ACTIONS.includes(row.action))
    .filter((row) => toMillis(row.createdAt) >= sinceMs)
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

async function handleReadPathFallbackSummary(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const limit = parseLimit(req);
  const windowHours = parseWindowHours(req);

  try {
    const rows = await listFallbackRows(limit, windowHours);
    const items = aggregateByAction(rows, limit);
    const recent = rows.slice(0, limit);

    try {
      await appendAuditLog({
        actor,
        action: 'read_path.fallback.summary.view',
        entityType: 'read_path',
        entityId: 'fallback_summary',
        traceId: traceId || undefined,
        requestId: requestId || undefined,
        payloadSummary: {
          limit,
          windowHours,
          rows: rows.length,
          grouped: items.length
        }
      });
    } catch (auditErr) {
      logRouteError('admin.read_path_fallback_summary.audit', auditErr, { actor, traceId, requestId });
    }

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      limit,
      windowHours,
      items,
      recent
    }));
  } catch (err) {
    logRouteError('admin.read_path_fallback_summary.view', err, { actor, traceId, requestId });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleReadPathFallbackSummary,
  READ_PATH_FALLBACK_ACTIONS
};
