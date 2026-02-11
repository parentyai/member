'use strict';

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, parseJson } = require('./osContext');

const SCREEN_TO_ACTION = Object.freeze({
  composer: 'admin_os.composer.view',
  monitor: 'admin_os.monitor.view',
  errors: 'admin_os.errors.view',
  master: 'admin_os.master.view'
});

async function handleView(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const screen = typeof payload.screen === 'string' ? payload.screen.trim() : '';
  const action = SCREEN_TO_ACTION[screen] || null;
  if (!action) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid screen', traceId }));
    return;
  }

  await appendAuditLog({
    actor,
    action,
    entityType: 'admin_os',
    entityId: screen,
    traceId,
    requestId,
    payloadSummary: { screen }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, serverTime: new Date().toISOString(), traceId, requestId, screen, action }));
}

module.exports = {
  handleView
};

