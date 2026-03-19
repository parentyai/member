'use strict';

const opsSnapshotsRepo = require('../../repos/firestore/opsSnapshotsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { resolveSnapshotFreshnessMinutes } = require('../../domain/readModel/snapshotReadPolicy');
const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
  logRouteError
} = require('./osContext');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 200;
const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.ops_snapshot_health';

function parseLimit(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('limit'));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(raw), MAX_LIMIT);
}

function parseStaleAfterMinutes(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = url.searchParams.get('staleAfterMinutes');
  if (!raw) return resolveSnapshotFreshnessMinutes({});
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('invalid staleAfterMinutes');
  }
  return resolveSnapshotFreshnessMinutes({ freshnessMinutes: value });
}

function parseSnapshotType(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = url.searchParams.get('snapshotType');
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (!value) return null;
  return value;
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
    return null;
  }
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : null;
  }
  if (Number.isFinite(value && value._seconds)) return Number(value._seconds) * 1000;
  return null;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function isStaleSnapshot(snapshot, staleAfterMinutes) {
  const asOfMs = toMillis(snapshot && snapshot.asOf);
  if (!Number.isFinite(asOfMs)) return true;
  return Date.now() - asOfMs > staleAfterMinutes * 60 * 1000;
}

function normalizeSnapshot(snapshot, staleAfterMinutes) {
  return {
    id: snapshot && snapshot.id ? snapshot.id : null,
    snapshotType: snapshot && snapshot.snapshotType ? snapshot.snapshotType : null,
    snapshotKey: snapshot && snapshot.snapshotKey ? snapshot.snapshotKey : null,
    asOf: normalizeTimestamp(snapshot && snapshot.asOf),
    freshnessMinutes: Number.isFinite(Number(snapshot && snapshot.freshnessMinutes))
      ? Number(snapshot.freshnessMinutes)
      : null,
    sourceTraceId: snapshot && snapshot.sourceTraceId ? snapshot.sourceTraceId : null,
    updatedAt: normalizeTimestamp(snapshot && snapshot.updatedAt),
    isStale: isStaleSnapshot(snapshot, staleAfterMinutes)
  };
}

function normalizeOutcomeOptions(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = ROUTE_KEY;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleOpsSnapshotHealth(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const limit = parseLimit(req);
  const snapshotType = parseSnapshotType(req);

  let staleAfterMinutes;
  try {
    staleAfterMinutes = parseStaleAfterMinutes(req);
  } catch (err) {
    writeJson(res, 400, { ok: false, error: err.message, traceId, requestId }, {
      state: 'error',
      reason: 'invalid_stale_after_minutes',
      guard: { decision: 'block' }
    });
    return;
  }

  try {
    const rows = await opsSnapshotsRepo.listSnapshots({ limit, snapshotType });
    const items = rows.map((row) => normalizeSnapshot(row, staleAfterMinutes));

    try {
      await appendAuditLog({
        actor,
        action: 'ops_snapshot.health.view',
        entityType: 'ops_snapshot',
        entityId: 'global',
        traceId: traceId || undefined,
        requestId: requestId || undefined,
        payloadSummary: {
          limit,
          snapshotType,
          staleAfterMinutes,
          count: items.length
        }
      });
    } catch (auditErr) {
      logRouteError('admin.ops_snapshot_health.audit', auditErr, { actor, traceId, requestId });
    }

    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      limit,
      snapshotType,
      staleAfterMinutes,
      items
    }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    logRouteError('admin.ops_snapshot_health.view', err, { actor, traceId, requestId });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleOpsSnapshotHealth
};
