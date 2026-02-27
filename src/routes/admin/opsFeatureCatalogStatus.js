'use strict';

const opsSnapshotsRepo = require('../../repos/firestore/opsSnapshotsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
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
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function normalizeRow(snapshot) {
  const row = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  return Object.assign({
    featureId: row.snapshotKey || null,
    updatedAt: normalizeTimestamp(row.updatedAt),
    asOf: normalizeTimestamp(row.asOf)
  }, data);
}

function sortRows(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  return list.sort((a, b) => {
    const leftOrder = Number.isFinite(Number(a && a.rowOrder)) ? Number(a.rowOrder) : Number.MAX_SAFE_INTEGER;
    const rightOrder = Number.isFinite(Number(b && b.rowOrder)) ? Number(b.rowOrder) : Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    const leftLabel = String((a && (a.featureLabelJa || a.featureId)) || '');
    const rightLabel = String((b && (b.featureLabelJa || b.featureId)) || '');
    return leftLabel.localeCompare(rightLabel, 'ja');
  });
}

async function handleOpsFeatureCatalogStatus(req, res) {
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
    const [catalogDoc, rowDocs] = await Promise.all([
      opsSnapshotsRepo.getSnapshot('ops_feature_status', 'catalog'),
      opsSnapshotsRepo.listSnapshots({ snapshotType: 'ops_feature_status', limit: 250 })
    ]);

    const catalogData = catalogDoc && catalogDoc.data && typeof catalogDoc.data === 'object'
      ? catalogDoc.data
      : null;
    const rowsFromCatalog = Array.isArray(catalogData && catalogData.rows) ? catalogData.rows : [];
    const rowsFromDocs = rowDocs
      .filter((row) => row && row.snapshotKey !== 'catalog')
      .map((row) => normalizeRow(row));
    const rows = sortRows(rowsFromCatalog.length ? rowsFromCatalog : rowsFromDocs);
    const catalog = catalogData
      ? Object.assign({}, catalogData, {
          updatedAt: normalizeTimestamp(catalogDoc.updatedAt),
          asOf: normalizeTimestamp(catalogDoc.asOf)
        })
      : null;

    try {
      await appendAuditLog({
        actor,
        action: 'ops_feature_catalog_status.view',
        entityType: 'ops_snapshot',
        entityId: 'catalog',
        traceId: traceId || undefined,
        requestId: requestId || undefined,
        payloadSummary: {
          available: Boolean(catalog),
          rowCount: rows.length
        }
      });
    } catch (auditErr) {
      logRouteError('admin.ops_feature_catalog_status.audit', auditErr, { actor, traceId, requestId });
    }

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      source: 'snapshot',
      available: Boolean(catalog || rows.length),
      catalog,
      rows
    }));
  } catch (err) {
    logRouteError('admin.ops_feature_catalog_status.view', err, { actor, traceId, requestId });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleOpsFeatureCatalogStatus
};

