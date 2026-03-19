'use strict';

const opsSnapshotsRepo = require('../../repos/firestore/opsSnapshotsRepo');
const { buildOpsSnapshots } = require('../../usecases/admin/buildOpsSnapshots');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
  logRouteError
} = require('./osContext');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_TYPE = 'admin_route';
const VIEW_ROUTE_KEY = 'admin.ops_system_snapshot';
const REBUILD_ROUTE_KEY = 'admin.ops_system_snapshot_rebuild';

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  return defaultValue === true;
}

function resolveOpsSystemSnapshotEnabled() {
  return resolveBooleanEnvFlag('ENABLE_OPS_SYSTEM_SNAPSHOT_V1', true);
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date) return date.toISOString();
    return null;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function parseScanLimit(rawValue) {
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) return 2000;
  return Math.max(100, Math.min(Math.floor(value), 3000));
}

function normalizeSnapshotDoc(snapshot) {
  const row = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  return Object.assign({
    id: row.id || null,
    snapshotType: row.snapshotType || null,
    snapshotKey: row.snapshotKey || null,
    asOf: normalizeTimestamp(row.asOf),
    freshnessMinutes: Number.isFinite(Number(row.freshnessMinutes)) ? Number(row.freshnessMinutes) : null,
    sourceTraceId: row.sourceTraceId || null,
    updatedAt: normalizeTimestamp(row.updatedAt),
    createdAt: normalizeTimestamp(row.createdAt)
  }, data);
}

function normalizeOutcomeOptions(routeKey, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = routeKey;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, status, payload, routeKey, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(routeKey, outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function parseRebuildJson(bodyText, req, res, traceId, requestId) {
  try {
    return JSON.parse(bodyText || '{}');
  } catch (_err) {
    writeJson(res, 400, { ok: false, error: 'invalid json', traceId, requestId }, REBUILD_ROUTE_KEY, {
      state: 'error',
      reason: 'invalid_json',
      guard: { decision: 'block' }
    });
    return null;
  }
}

async function handleOpsSystemSnapshot(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  if (!resolveOpsSystemSnapshotEnabled()) {
    writeJson(res, 503, { ok: false, error: 'ops system snapshot disabled', traceId, requestId }, VIEW_ROUTE_KEY, {
      state: 'blocked',
      reason: 'ops_system_snapshot_disabled',
      guard: { decision: 'block' }
    });
    return;
  }

  try {
    const row = await opsSnapshotsRepo.getSnapshot('ops_system_snapshot', 'global');
    const snapshot = row ? normalizeSnapshotDoc(row) : null;

    try {
      await appendAuditLog({
        actor,
        action: 'ops_system_snapshot.view',
        entityType: 'ops_snapshot',
        entityId: 'global',
        traceId: traceId || undefined,
        requestId: requestId || undefined,
        payloadSummary: {
          available: Boolean(snapshot),
          snapshotType: snapshot ? snapshot.snapshotType : 'ops_system_snapshot',
          snapshotKey: snapshot ? snapshot.snapshotKey : 'global'
        }
      });
    } catch (auditErr) {
      logRouteError('admin.ops_system_snapshot.audit', auditErr, { actor, traceId, requestId });
    }

    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      source: 'snapshot',
      available: Boolean(snapshot),
      snapshot
    }, VIEW_ROUTE_KEY, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    logRouteError('admin.ops_system_snapshot.view', err, { actor, traceId, requestId });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, VIEW_ROUTE_KEY, {
      state: 'error',
      reason: 'error'
    });
  }
}

async function handleOpsSystemSnapshotRebuild(req, res, bodyText) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  if (!resolveOpsSystemSnapshotEnabled()) {
    writeJson(res, 503, { ok: false, error: 'ops system snapshot disabled', traceId, requestId }, REBUILD_ROUTE_KEY, {
      state: 'blocked',
      reason: 'ops_system_snapshot_disabled',
      guard: { decision: 'block' }
    });
    return;
  }

  const payload = parseRebuildJson(bodyText, req, res, traceId, requestId);
  if (!payload) return;

  try {
    const result = await buildOpsSnapshots({
      actor,
      traceId,
      requestId,
      dryRun: payload.dryRun === true,
      scanLimit: parseScanLimit(payload.scanLimit),
      targets: ['ops_system_snapshot']
    });
    writeJson(res, 200, Object.assign({ ok: true }, result), REBUILD_ROUTE_KEY, {
      state: 'success',
      reason: payload.dryRun === true ? 'dry_run' : 'completed'
    });
  } catch (err) {
    logRouteError('admin.ops_system_snapshot.rebuild', err, { actor, traceId, requestId });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, REBUILD_ROUTE_KEY, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleOpsSystemSnapshot,
  handleOpsSystemSnapshotRebuild
};
