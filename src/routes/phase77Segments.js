'use strict';

const { createOpsSegment } = require('../usecases/phase77/createOpsSegment');
const { listOpsSegments } = require('../usecases/phase77/listOpsSegments');
const { getOpsSegment } = require('../usecases/phase77/getOpsSegment');

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
  if (message.includes('required') || message.includes('invalid') || message.includes('exists')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

function parsePath(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  const key = parts.length >= 4 ? parts[3] : null;
  return { key, parts };
}

async function handleSegments(req, res, body, pathname) {
  const { key, parts } = parsePath(pathname);
  try {
    if (req.method === 'GET' && parts.length === 3) {
      const url = new URL(req.url, 'http://localhost');
      const status = url.searchParams.get('status');
      const items = await listOpsSegments({ status });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(items));
      return;
    }
    if (req.method === 'POST' && parts.length === 3) {
      const payload = parseJson(body, res);
      if (!payload) return;
      const created = await createOpsSegment(payload);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(created));
      return;
    }
    if (req.method === 'GET' && key) {
      const result = await getOpsSegment({ segmentKey: key });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'not found' }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleSegments
};
