'use strict';

const opsSnapshotsRepo = require('../../repos/firestore/opsSnapshotsRepo');
const { buildOpsSnapshots } = require('../../usecases/admin/buildOpsSnapshots');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
  parseJson,
  logRouteError
} = require('./osContext');

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

async function handleOpsSystemSnapshot(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  if (!resolveOpsSystemSnapshotEnabled()) {
    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'ops system snapshot disabled', traceId, requestId }));
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

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      source: 'snapshot',
      available: Boolean(snapshot),
      snapshot
    }));
  } catch (err) {
    logRouteError('admin.ops_system_snapshot.view', err, { actor, traceId, requestId });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

async function handleOpsSystemSnapshotRebuild(req, res, bodyText) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  if (!resolveOpsSystemSnapshotEnabled()) {
    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'ops system snapshot disabled', traceId, requestId }));
    return;
  }

  const payload = parseJson(bodyText, res);
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({ ok: true }, result)));
  } catch (err) {
    logRouteError('admin.ops_system_snapshot.rebuild', err, { actor, traceId, requestId });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleOpsSystemSnapshot,
  handleOpsSystemSnapshotRebuild
};

