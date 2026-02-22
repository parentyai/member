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

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 200;

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

async function handleOpsSnapshotHealth(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const limit = parseLimit(req);

  let staleAfterMinutes;
  try {
    staleAfterMinutes = parseStaleAfterMinutes(req);
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err.message }));
    return;
  }

  try {
    const rows = await opsSnapshotsRepo.listSnapshots({ limit });
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
          staleAfterMinutes,
          count: items.length
        }
      });
    } catch (auditErr) {
      logRouteError('admin.ops_snapshot_health.audit', auditErr, { actor, traceId, requestId });
    }

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      limit,
      staleAfterMinutes,
      items
    }));
  } catch (err) {
    logRouteError('admin.ops_snapshot_health.view', err, { actor, traceId, requestId });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleOpsSnapshotHealth
};
