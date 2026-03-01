'use strict';

const { listRetryQueue } = require('../usecases/phase73/listRetryQueue');
const { planRetryQueuedSend } = require('../usecases/phase73/planRetryQueuedSend');
const { retryQueuedSend } = require('../usecases/phase73/retryQueuedSend');
const { giveUpRetryQueuedSend } = require('../usecases/phase73/giveUpRetryQueuedSend');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./admin/osContext');

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

function handleError(res, err, context) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('invalid')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  const traceId = context && context.traceId ? context.traceId : null;
  const requestId = context && context.requestId ? context.requestId : null;
  logRouteError('phase73.retry_queue', err, context);
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
}

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  return defaultValue === true;
}

function isRetryQueueGiveUpEnabled() {
  return resolveBooleanEnvFlag('ENABLE_RETRY_QUEUE_GIVEUP_V1', true);
}

async function handleListRetryQueue(req, res, deps) {
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  try {
    const url = new URL(req.url, 'http://localhost');
    const limit = url.searchParams.get('limit');
    const result = await listRetryQueue({
      limit: limit !== null ? Number(limit) : undefined
    }, deps);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({}, result, { traceId, requestId })));
  } catch (err) {
    handleError(res, err, { traceId, requestId });
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
    handleError(res, err, { traceId, requestId, actor });
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
    handleError(res, err, { traceId, requestId, actor });
  }
}

async function handleGiveUpSend(req, res, body, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  if (!isRetryQueueGiveUpEnabled()) {
    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: false,
      error: 'retry_queue_give_up_disabled',
      traceId,
      requestId
    }));
    return;
  }
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await giveUpRetryQueuedSend(Object.assign({}, payload, { actor, traceId, requestId }), deps);
    const status = result && typeof result.status === 'number' ? result.status : 200;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({}, result, { traceId, requestId })));
  } catch (err) {
    handleError(res, err, { traceId, requestId, actor });
  }
}

module.exports = {
  handleListRetryQueue,
  handlePlanRetryQueue,
  handleRetrySend,
  handleGiveUpSend
};
