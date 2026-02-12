'use strict';

const { buildSendSegment } = require('../usecases/phase66/buildSendSegment');
const { resolveRequestId, resolveTraceId, logRouteError } = require('./admin/osContext');

function handleError(res, err, context) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('invalid')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  const traceId = context && context.traceId ? context.traceId : null;
  const requestId = context && context.requestId ? context.requestId : null;
  logRouteError('phase66.send_targets', err, context);
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
}

async function handleSendTargets(req, res, deps) {
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  try {
    const url = new URL(req.url, 'http://localhost');
    const readinessStatus = url.searchParams.get('readinessStatus');
    const needsAttention = url.searchParams.get('needsAttention');
    const hasMemberNumber = url.searchParams.get('hasMemberNumber');
    const redacStatus = url.searchParams.get('redacStatus');
    const limit = url.searchParams.get('limit');
    const result = await buildSendSegment({
      readinessStatus,
      needsAttention,
      hasMemberNumber,
      redacStatus,
      limit: limit !== null ? Number(limit) : undefined
    }, deps);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({}, result, { traceId, requestId })));
  } catch (err) {
    handleError(res, err, { traceId, requestId });
  }
}

module.exports = {
  handleSendTargets
};
