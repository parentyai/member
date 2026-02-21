'use strict';

const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { runStructDriftBackfill } = require('../../usecases/structure/runStructDriftBackfill');
const { requireActor, resolveRequestId, resolveTraceId, parseJson, logRouteError } = require('./osContext');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseLimit(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('limit'));
  if (!Number.isFinite(raw) || raw <= 0) return 20;
  return Math.min(Math.floor(raw), 200);
}

async function handleListRuns(req, res, context) {
  const limit = parseLimit(req);
  const rows = await auditLogsRepo.listAuditLogs({ action: 'struct_drift.backfill.execute', limit });
  const items = rows.map((row) => ({
    id: row.id,
    actor: row.actor || 'unknown',
    traceId: row.traceId || null,
    createdAt: row.createdAt || null,
    mode: row && row.payloadSummary && row.payloadSummary.mode ? row.payloadSummary.mode : null,
    changedCount: row && row.payloadSummary && Number.isFinite(Number(row.payloadSummary.changedCount))
      ? Number(row.payloadSummary.changedCount)
      : null,
    scanLimit: row && row.payloadSummary && Number.isFinite(Number(row.payloadSummary.scanLimit))
      ? Number(row.payloadSummary.scanLimit)
      : null,
    resumeAfterUserId: row && row.payloadSummary ? row.payloadSummary.resumeAfterUserId || null : null,
    summary: row && row.payloadSummary ? row.payloadSummary.summary || null : null
  }));

  await appendAuditLog({
    actor: context.actor,
    action: 'struct_drift.backfill_runs.view',
    entityType: 'struct_drift',
    entityId: 'global',
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: { limit, count: items.length }
  });

  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    requestId: context.requestId,
    limit,
    items
  });
}

async function handleExecute(req, res, body, context) {
  const payload = parseJson(body, res);
  if (!payload) return;
  const wantsApply = payload && (payload.apply === true || payload.dryRun === false);
  if (wantsApply && payload.confirmApply !== true) {
    writeJson(res, 400, { ok: false, error: 'confirmApply required for apply', traceId: context.traceId });
    return;
  }

  const result = await runStructDriftBackfill({
    dryRun: payload.dryRun,
    apply: payload.apply,
    scanLimit: payload.scanLimit,
    resumeAfterUserId: payload.resumeAfterUserId
  });

  await appendAuditLog({
    actor: context.actor,
    action: 'struct_drift.backfill.execute',
    entityType: 'struct_drift',
    entityId: 'global',
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      mode: result.summary && result.summary.mode ? result.summary.mode : null,
      changedCount: result.summary && Number.isFinite(Number(result.summary.changedCount))
        ? Number(result.summary.changedCount)
        : 0,
      scanLimit: result.summary && Number.isFinite(Number(result.summary.scanLimit))
        ? Number(result.summary.scanLimit)
        : null,
      resumeAfterUserId: result.summary ? result.summary.resumeAfterUserId || null : null,
      summary: result.summary || null
    }
  });

  writeJson(res, 200, Object.assign({}, result, {
    traceId: context.traceId,
    requestId: context.requestId
  }));
}

async function handleStructDriftBackfillAdmin(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const context = {
    actor,
    traceId: resolveTraceId(req),
    requestId: resolveRequestId(req)
  };

  try {
    if (req.method === 'GET') {
      await handleListRuns(req, res, context);
      return;
    }
    if (req.method === 'POST') {
      await handleExecute(req, res, body, context);
      return;
    }
    writeJson(res, 404, { ok: false, error: 'not found', traceId: context.traceId });
  } catch (err) {
    logRouteError('admin.struct_drift_backfill', err, context);
    writeJson(res, 500, { ok: false, error: 'error', traceId: context.traceId });
  }
}

module.exports = {
  handleStructDriftBackfillAdmin
};
