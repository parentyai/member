'use strict';

const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { runCanonicalCoreOutboxSyncJob } = require('../../usecases/data/runCanonicalCoreOutboxSyncJob');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
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

async function handleCanonicalCoreOutboxSyncJob(req, res, bodyText) {
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' });
    return;
  }
  if (!requireInternalJobToken(req, res)) return;

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' });
    return;
  }

  const traceId = resolveTraceId(req, payload);
  const requestId = resolveRequestId(req, payload);

  const result = await runCanonicalCoreOutboxSyncJob({
    dryRun: payload.dryRun,
    limit: payload.limit,
    traceId,
    requestId,
    actor: 'canonical_core_outbox_sync_job'
  });
  writeJson(res, 200, result);
}

module.exports = {
  handleCanonicalCoreOutboxSyncJob
};
