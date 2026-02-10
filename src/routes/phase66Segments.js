'use strict';

const { buildSendSegment } = require('../usecases/phase66/buildSendSegment');

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('invalid')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handleSendTargets(req, res, deps) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const readinessStatus = url.searchParams.get('readinessStatus');
    const needsAttention = url.searchParams.get('needsAttention');
    const hasMemberNumber = url.searchParams.get('hasMemberNumber');
    const ridacStatus = url.searchParams.get('ridacStatus');
    const limit = url.searchParams.get('limit');
    const result = await buildSendSegment({
      readinessStatus,
      needsAttention,
      hasMemberNumber,
      ridacStatus,
      limit: limit !== null ? Number(limit) : undefined
    }, deps);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleSendTargets
};
