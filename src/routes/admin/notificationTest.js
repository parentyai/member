'use strict';

const { runNotificationTest } = require('../../usecases/notifications/runNotificationTest');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { resolveActor, resolveRequestId, resolveTraceId, parseJson } = require('./osContext');

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

async function handleSendTest(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  const notificationId = payload.notificationId;
  if (!notificationId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'notificationId required' }));
    return;
  }
  const mode = payload.mode === 'dry_run' ? 'dry_run' : 'self_send';
  if (mode === 'self_send' && !payload.lineUserId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'lineUserId required' }));
    return;
  }
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const actor = resolveActor(req);
  try {
    const result = await runNotificationTest({
      mode,
      notificationId,
      lineUserId: payload.lineUserId || null,
      traceId,
      requestId,
      actor,
      persist: true,
      useRegistry: false
    });
    try {
      await appendAuditLog({
        actor,
        action: 'notifications.test_run',
        entityType: 'notification',
        entityId: notificationId,
        traceId,
        requestId,
        payloadSummary: {
          mode,
          notificationId,
          runId: result.runId,
          ok: result.ok
        }
      });
    } catch (_err) {
      // best-effort only
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, runId: result.runId, traceId, summary: result.summary, results: result.results }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleTestRuns(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const actor = resolveActor(req);
  const mode = payload.mode === 'self_send' ? 'self_send' : 'dry_run';
  try {
    const result = await runNotificationTest({
      mode,
      patterns: Array.isArray(payload.patterns) ? payload.patterns : null,
      useRegistry: payload.useRegistry !== false,
      lineUserId: payload.lineUserId || null,
      traceId,
      requestId,
      actor,
      persist: true
    });
    try {
      await appendAuditLog({
        actor,
        action: 'notifications.test_run.batch',
        entityType: 'notification_test',
        entityId: result.runId,
        traceId,
        requestId,
        payloadSummary: {
          mode,
          runId: result.runId,
          total: result.summary.total,
          failed: result.summary.failed
        }
      });
    } catch (_err) {
      // best-effort only
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, runId: result.runId, traceId, summary: result.summary }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleSendTest,
  handleTestRuns
};
