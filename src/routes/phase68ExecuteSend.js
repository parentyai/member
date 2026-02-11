'use strict';

const { executeSegmentSend } = require('../usecases/phase68/executeSegmentSend');
const { resolveActor, resolveRequestId, resolveTraceId, parseJson } = require('./admin/osContext');

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('invalid') || message.includes('not found')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handleExecuteSend(req, res, body, deps) {
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const actor = resolveActor(req);
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const requestedBy = payload.requestedBy || actor;
    const result = await executeSegmentSend(Object.assign({}, payload, { requestedBy, traceId, requestId }), deps);
    const status = result && typeof result.status === 'number' ? result.status : 200;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({}, result, { traceId, requestId })));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleExecuteSend
};
