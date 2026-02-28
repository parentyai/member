'use strict';

const { logEventBestEffort } = require('../usecases/events/logEvent');

function isLegacyRouteFreezeEnabled() {
  const raw = process.env.LEGACY_ROUTE_FREEZE_ENABLED;
  if (raw === undefined || raw === null || String(raw).trim() === '') return false; // compat default
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

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
  if (isLegacyRouteFreezeEnabled()) {
    res.writeHead(410, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'legacy route frozen' }));
    return;
  }
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
