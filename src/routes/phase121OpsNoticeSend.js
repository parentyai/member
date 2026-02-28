'use strict';

const { sendOpsNotice } = require('../usecases/phase121/sendOpsNotice');

const LEGACY_SUNSET = 'Wed, 30 Sep 2026 00:00:00 GMT';
const LEGACY_SUCCESSOR = '/api/admin/os/notifications/send/execute';

function isLegacyRouteFreezeEnabled() {
  const raw = process.env.LEGACY_ROUTE_FREEZE_ENABLED;
  if (raw === undefined || raw === null || String(raw).trim() === '') return false; // compat default
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function applyDeprecationHeaders(res, successorPath) {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', LEGACY_SUNSET);
  if (typeof successorPath === 'string' && successorPath.trim().length > 0) {
    res.setHeader('Link', `<${successorPath.trim()}>; rel="successor-version"`);
  }
}

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
  if (message.includes('required') || message.includes('invalid')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handleOpsNoticeSend(req, res, body) {
  if (isLegacyRouteFreezeEnabled()) {
    applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
    res.writeHead(410, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'legacy route frozen', replacement: LEGACY_SUCCESSOR }));
    return;
  }
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await sendOpsNotice(payload);
    if (result && result.status === 409) {
      applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
      res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }
    applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleOpsNoticeSend
};
