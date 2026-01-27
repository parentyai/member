'use strict';

const { setKillSwitch } = require('../../usecases/killSwitch/setKillSwitch');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');

function resolveActor(req) {
  const actor = req && req.headers && req.headers['x-actor'];
  if (typeof actor === 'string' && actor.trim().length > 0) return actor.trim();
  return 'unknown';
}

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('invalid json');
    return null;
  }
}

async function handleSetKillSwitch(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  const isOn = typeof payload.isOn === 'boolean'
    ? payload.isOn
    : typeof payload.killSwitch === 'boolean'
      ? payload.killSwitch
      : null;
  if (isOn === null) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('isOn required');
    return;
  }
  const result = await setKillSwitch(isOn);
  await appendAuditLog({
    actor: resolveActor(req),
    action: 'kill_switch.set',
    entityType: 'system_flags',
    entityId: 'phase0',
    payloadSummary: { isOn }
  });
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, killSwitch: result.killSwitch }));
}

module.exports = {
  handleSetKillSwitch
};
