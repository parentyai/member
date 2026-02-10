'use strict';

const crypto = require('crypto');

function resolveActor(req) {
  const actor = req && req.headers && req.headers['x-actor'];
  if (typeof actor === 'string' && actor.trim().length > 0) return actor.trim();
  return 'unknown';
}

function requireActor(req, res) {
  const actor = resolveActor(req);
  if (actor === 'unknown') {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'x-actor required' }));
    return null;
  }
  return actor;
}

function resolveRequestId(req) {
  const headerId = req && req.headers && req.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.length > 0) return headerId;
  const trace = req && req.headers && req.headers['x-cloud-trace-context'];
  if (typeof trace === 'string' && trace.length > 0) return trace.split('/')[0];
  return 'unknown';
}

function resolveTraceId(req) {
  const headerId = req && req.headers && req.headers['x-trace-id'];
  if (typeof headerId === 'string' && headerId.trim().length > 0) return headerId.trim();
  const requestId = resolveRequestId(req);
  if (requestId && requestId !== 'unknown') return requestId;
  return crypto.randomUUID();
}

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (_err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

module.exports = {
  resolveActor,
  requireActor,
  resolveRequestId,
  resolveTraceId,
  parseJson
};

