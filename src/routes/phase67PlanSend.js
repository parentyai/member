'use strict';

const { planSegmentSend } = require('../usecases/phase67/planSegmentSend');
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

async function handlePlanSend(req, res, body, deps) {
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const actor = resolveActor(req);
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const requestedBy = payload.requestedBy || actor;
    const result = await planSegmentSend(Object.assign({}, payload, { requestedBy, traceId, requestId }), deps);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({}, result, { traceId, requestId })));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handlePlanSend
};
