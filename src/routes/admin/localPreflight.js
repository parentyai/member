'use strict';

const { runLocalPreflight } = require('../../../tools/admin_local_preflight');
const {
  requireActor,
  resolveRequestId,
  resolveTraceId,
  logRouteError
} = require('./osContext');

async function handleLocalPreflight(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  try {
    const result = await runLocalPreflight({ env: process.env });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      actor,
      ready: result.ready === true,
      checkedAt: result.checkedAt || null,
      checks: result.checks || {},
      summary: result.summary || null
    }));
  } catch (err) {
    logRouteError('admin.local_preflight', err, { actor, traceId, requestId });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleLocalPreflight
};
