'use strict';

const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
  logRouteError
} = require('./osContext');

const RETENTION_ACTIONS = new Set([
  'retention.dry_run.execute',
  'retention.apply.execute',
  'retention.apply.blocked'
]);

function parseLimit(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('limit'));
  if (!Number.isFinite(raw) || raw <= 0) return 20;
  return Math.min(Math.floor(raw), 200);
}

function parseTraceId(req) {
  const url = new URL(req.url, 'http://localhost');
  const value = url.searchParams.get('traceId');
  if (!value || !value.trim()) return null;
  return value.trim();
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function normalizeRow(row) {
  const payloadSummary = row && row.payloadSummary ? row.payloadSummary : {};
  const summary = payloadSummary && payloadSummary.summary && typeof payloadSummary.summary === 'object'
    ? payloadSummary.summary
    : {};
  const deletedSamples = Array.isArray(payloadSummary.deletedSamples) ? payloadSummary.deletedSamples : [];
  const sampleDeletedIds = deletedSamples
    .flatMap((item) => (item && Array.isArray(item.ids) ? item.ids : []))
    .slice(0, 50);
  const collections = Array.isArray(payloadSummary.collections)
    ? payloadSummary.collections
    : (Array.isArray(summary.collections) ? summary.collections : []);

  return {
    id: row.id,
    action: row.action || null,
    actor: row.actor || 'unknown',
    traceId: row.traceId || null,
    requestId: row.requestId || null,
    createdAt: row.createdAt || null,
    dryRunTraceId: payloadSummary.dryRunTraceId || null,
    deletedCount: Number.isFinite(Number(summary.deletedCount)) ? Number(summary.deletedCount) : 0,
    collection: collections.length === 1 ? collections[0] : null,
    collections,
    sampleDeletedIds
  };
}

function filterRetentionActions(rows) {
  return (rows || []).filter((row) => RETENTION_ACTIONS.has(row && row.action));
}

async function listRetentionRuns(limit, traceId) {
  if (traceId) {
    const rows = await auditLogsRepo.listAuditLogsByTraceId(traceId, Math.max(limit * 5, 100));
    return filterRetentionActions(rows).slice(0, limit);
  }

  const actions = Array.from(RETENTION_ACTIONS.values());
  const grouped = await Promise.all(actions.map((action) => auditLogsRepo.listAuditLogs({ action, limit })));
  return grouped
    .flat()
    .filter((row) => RETENTION_ACTIONS.has(row && row.action))
    .sort((a, b) => toMillis(b && b.createdAt) - toMillis(a && a.createdAt))
    .slice(0, limit);
}

async function handleRetentionRuns(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const limit = parseLimit(req);
  const queryTraceId = parseTraceId(req);

  try {
    const rows = await listRetentionRuns(limit, queryTraceId);
    const items = rows.map(normalizeRow);

    try {
      await appendAuditLog({
        actor,
        action: 'retention.runs.view',
        entityType: 'retention_policy',
        entityId: 'global',
        traceId: traceId || undefined,
        requestId: requestId || undefined,
        payloadSummary: {
          limit,
          queryTraceId,
          count: items.length
        }
      });
    } catch (auditErr) {
      logRouteError('admin.retention_runs.audit', auditErr, { actor, traceId, requestId });
    }

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      limit,
      queryTraceId,
      items
    }));
  } catch (err) {
    logRouteError('admin.retention_runs.view', err, { actor, traceId, requestId });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleRetentionRuns
};
