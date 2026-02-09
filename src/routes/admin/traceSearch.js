'use strict';

const { getTraceBundle } = require('../../usecases/admin/getTraceBundle');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');

function resolveActor(req) {
  const actor = req && req.headers && req.headers['x-actor'];
  if (typeof actor === 'string' && actor.trim().length > 0) return actor.trim();
  return 'unknown';
}

function resolveRequestId(req) {
  const headerId = req && req.headers && req.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.length > 0) return headerId;
  const trace = req && req.headers && req.headers['x-cloud-trace-context'];
  if (typeof trace === 'string' && trace.length > 0) return trace.split('/')[0];
  return 'unknown';
}

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('invalid')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handleAdminTraceSearch(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const traceId = url.searchParams.get('traceId');
  const limit = url.searchParams.get('limit');
  const actor = resolveActor(req);
  const requestId = resolveRequestId(req);
  try {
    const result = await getTraceBundle({ traceId, limit });
    try {
      await appendAuditLog({
        actor,
        action: 'trace_search.view',
        entityType: 'trace',
        entityId: traceId || 'unknown',
        traceId,
        requestId,
        payloadSummary: { traceId, limit: limit || null }
      });
    } catch (_err) {
      // best-effort only
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleAdminTraceSearch
};
