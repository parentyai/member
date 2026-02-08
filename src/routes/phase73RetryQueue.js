'use strict';

const { listRetryQueue } = require('../usecases/phase73/listRetryQueue');
const { retryQueuedSend } = require('../usecases/phase73/retryQueuedSend');

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

async function handleRetrySend(req, res, body, deps) {
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await retryQueuedSend(payload, deps);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleListRetryQueue,
  handleRetrySend
};
