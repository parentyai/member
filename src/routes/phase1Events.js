'use strict';

const { logEventBestEffort } = require('../usecases/events/logEvent');

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

async function handlePhase1Event(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  const result = await logEventBestEffort({
    lineUserId: payload.lineUserId,
    type: payload.type,
    ref: payload.ref
  });
  if (!result.ok) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: result.error }));
    return;
  }
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, id: result.id }));
}

module.exports = {
  handlePhase1Event
};
