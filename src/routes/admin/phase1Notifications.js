'use strict';

const { createNotificationPhase1 } = require('../../usecases/notifications/createNotificationPhase1');
const { sendNotificationPhase1 } = require('../../usecases/notifications/sendNotificationPhase1');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');

const LEGACY_SUNSET = 'Wed, 30 Sep 2026 00:00:00 GMT';
const LEGACY_SUCCESSOR = '/api/admin/os/notifications/list';

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
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('invalid json');
    return null;
  }
}

function isKillSwitchError(err) {
  return err && typeof err.message === 'string' && err.message.includes('kill switch');
}

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
  if (message.includes('not found')) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  if (message.includes('required') || message.includes('invalid') || message.includes('no recipients')) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(message);
    return;
  }
  res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('error');
}

async function handleCreatePhase1(req, res, body) {
  if (isLegacyRouteFreezeEnabled()) {
    applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
    res.writeHead(410, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'legacy route frozen', replacement: LEGACY_SUCCESSOR }));
    return;
  }
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await createNotificationPhase1(payload);
    applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, id: result.id }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleSendPhase1(req, res, body, notificationId) {
  if (isLegacyRouteFreezeEnabled()) {
    applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
    res.writeHead(410, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'legacy route frozen', replacement: LEGACY_SUCCESSOR }));
    return;
  }
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const killSwitch = await getKillSwitch();
    const result = await sendNotificationPhase1({
      notificationId,
      sentAt: payload.sentAt,
      killSwitch
    });
    applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, deliveredCount: result.deliveredCount }));
  } catch (err) {
    if (isKillSwitchError(err)) {
      applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('kill switch on');
      return;
    }
    handleError(res, err);
  }
}

module.exports = {
  handleCreatePhase1,
  handleSendPhase1
};
