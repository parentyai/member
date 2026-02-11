'use strict';

const { getOpsConsole } = require('../usecases/phase25/getOpsConsole');
const systemFlagsRepo = require('../repos/firestore/systemFlagsRepo');

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

async function handleGetOpsConsole(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = url.searchParams.get('lineUserId');
  const traceId = url.searchParams.get('traceId');
  if (!lineUserId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'lineUserId required' }));
    return;
  }
  try {
    const result = await getOpsConsole({
      lineUserId,
      auditView: true,
      actor: resolveActor(req),
      requestId: resolveRequestId(req),
      traceId: traceId && traceId.trim().length > 0 ? traceId.trim() : null
    });
    try {
      const [servicePhase, notificationPreset, notificationCaps] = await Promise.all([
        systemFlagsRepo.getServicePhase(),
        systemFlagsRepo.getNotificationPreset(),
        systemFlagsRepo.getNotificationCaps()
      ]);
      result.servicePhase = servicePhase;
      result.notificationPreset = notificationPreset;
      result.notificationCaps = notificationCaps;
    } catch (_err) {
      result.servicePhase = null;
      result.notificationPreset = null;
      result.notificationCaps = { perUserWeeklyCap: null };
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleGetOpsConsole
};
