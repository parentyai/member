'use strict';

const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { runCanonicalCoreOutboxSyncJob } = require('../../usecases/data/runCanonicalCoreOutboxSyncJob');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_KEY = 'internal_canonical_core_outbox_sync_job';

function writeJson(res, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, Object.assign({
    routeType: 'internal_job',
    guard: { routeKey: ROUTE_KEY }
  }, outcomeOptions || {}));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function parseJson(bodyText) {
  try {
    return JSON.parse(bodyText || '{}');
  } catch (_err) {
    return null;
  }
}

function resolveTraceId(req, payload) {
  const headerTraceId = req && req.headers && typeof req.headers['x-trace-id'] === 'string'
    ? req.headers['x-trace-id'].trim()
    : '';
  if (headerTraceId) return headerTraceId;
  if (payload && typeof payload.traceId === 'string' && payload.traceId.trim()) return payload.traceId.trim();
  return null;
}

function resolveRequestId(req, payload) {
  const headerRequestId = req && req.headers && typeof req.headers['x-request-id'] === 'string'
    ? req.headers['x-request-id'].trim()
    : '';
  if (headerRequestId) return headerRequestId;
  if (payload && typeof payload.requestId === 'string' && payload.requestId.trim()) return payload.requestId.trim();
  return null;
}

function resolveOutcome(result) {
  const row = result && typeof result === 'object' ? result : {};
  if (row.dryRun === true) return { state: 'success', reason: 'dry_run' };
  if (Number(row.failedCount) > 0 && Number(row.syncedCount) > 0) return { state: 'partial', reason: 'completed_with_failures' };
  if (Number(row.failedCount) > 0) return { state: 'error', reason: 'completed_with_failures' };
  if (Number(row.scannedCount) === 0) return { state: 'success', reason: 'no_pending_items' };
  if (Number(row.skippedCount) > 0 && Number(row.syncedCount) === 0) return { state: 'success', reason: 'skipped' };
  return { state: 'success', reason: 'completed' };
}

async function handleCanonicalCoreOutboxSyncJob(req, res, bodyText, deps) {
  const runCanonicalCoreOutboxSyncJobFn = deps && typeof deps.runCanonicalCoreOutboxSyncJobFn === 'function'
    ? deps.runCanonicalCoreOutboxSyncJobFn
    : runCanonicalCoreOutboxSyncJob;
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' }, {
      state: 'error',
      reason: 'not_found',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }
  if (!requireInternalJobToken(req, res, {
    routeType: 'internal_job',
    guard: { routeKey: ROUTE_KEY }
  })) return;

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' }, {
      state: 'error',
      reason: 'invalid_json',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  const traceId = resolveTraceId(req, payload);
  const requestId = resolveRequestId(req, payload);

  const result = await runCanonicalCoreOutboxSyncJobFn({
    dryRun: payload.dryRun,
    limit: payload.limit,
    traceId,
    requestId,
    actor: 'canonical_core_outbox_sync_job'
  });
  writeJson(res, 200, result, Object.assign(resolveOutcome(result), {
    guard: { routeKey: ROUTE_KEY, decision: 'allow' }
  }));
}

module.exports = {
  handleCanonicalCoreOutboxSyncJob
};
