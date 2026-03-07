'use strict';

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { getNextBestAction } = require('../../usecases/tasks/getNextBestAction');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

function parseLineUserId(req) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = url.searchParams.get('lineUserId');
  if (typeof lineUserId !== 'string') return '';
  return lineUserId.trim();
}

async function handleNextBestAction(req, res, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const lineUserId = parseLineUserId(req);
  if (!lineUserId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'lineUserId required', traceId, requestId }));
    return;
  }

  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const compute = typeof resolvedDeps.getNextBestAction === 'function'
    ? resolvedDeps.getNextBestAction
    : getNextBestAction;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;

  try {
    const result = await compute({
      lineUserId,
      actor,
      traceId,
      requestId
    }, resolvedDeps);

    await appendAudit({
      actor,
      action: 'uxos.next_best_action.view',
      entityType: 'user',
      entityId: lineUserId,
      traceId,
      requestId,
      payloadSummary: {
        authority: result && result.authority ? result.authority : null,
        enabled: result && result.enabled === true,
        hasNextBestAction: Boolean(result && result.nextBestAction),
        fallbackReason: result && result.fallbackReason ? result.fallbackReason : null
      }
    });

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      result
    }));
  } catch (err) {
    logRouteError('admin.os_next_best_action', err, { traceId, requestId, actor, lineUserId });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleNextBestAction
};
