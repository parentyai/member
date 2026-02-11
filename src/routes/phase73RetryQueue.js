'use strict';

const { listRetryQueue } = require('../usecases/phase73/listRetryQueue');
const { planRetryQueuedSend } = require('../usecases/phase73/planRetryQueuedSend');
const { retryQueuedSend } = require('../usecases/phase73/retryQueuedSend');
const { requireActor, resolveRequestId, resolveTraceId } = require('./admin/osContext');

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
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

async function handleListRetryQueue(req, res, deps) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const limit = url.searchParams.get('limit');
    const result = await listRetryQueue({
      limit: limit !== null ? Number(limit) : undefined
    }, deps);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

async function handlePlanRetryQueue(req, res, body, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await planRetryQueuedSend(Object.assign({}, payload, { actor, traceId, requestId }), deps);
    const status = result && typeof result.status === 'number' ? result.status : 200;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({}, result, { traceId, requestId })));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleRetrySend(req, res, body, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await retryQueuedSend(Object.assign({}, payload, { actor, traceId, requestId }), deps);
    const status = result && typeof result.status === 'number' ? result.status : 200;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({}, result, { traceId, requestId })));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleListRetryQueue,
  handlePlanRetryQueue,
  handleRetrySend
};
