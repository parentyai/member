'use strict';

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { getNextBestAction } = require('../../usecases/uxos/getNextBestAction');
const { requireActor, resolveRequestId, resolveTraceId } = require('./osContext');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function handleStatus(req, res, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = url.searchParams.get('lineUserId');
  if (!lineUserId) {
    writeJson(res, 400, { ok: false, error: 'lineUserId required', traceId, requestId });
    return;
  }

  try {
    const result = await getNextBestAction({
      lineUserId,
      actor,
      traceId,
      requestId
    }, deps);

    await appendAuditLog({
      actor,
      action: 'uxos.next_action.view',
      entityType: 'uxos',
      entityId: lineUserId,
      traceId,
      requestId,
      payloadSummary: {
        enabled: result.enabled === true,
        source: result.source || null,
        action: result.recommendation && result.recommendation.action
          ? result.recommendation.action
          : null
      }
    }).catch(() => null);

    writeJson(res, 200, Object.assign({
      ok: true,
      traceId,
      requestId
    }, result));
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.includes('required') || message.includes('invalid')) {
      writeJson(res, 400, { ok: false, error: message, traceId, requestId });
      return;
    }
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId });
  }
}

module.exports = {
  handleStatus
};
