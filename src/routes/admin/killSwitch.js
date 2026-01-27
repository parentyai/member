'use strict';

const { setKillSwitch } = require('../../usecases/killSwitch/setKillSwitch');

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
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, killSwitch: result.killSwitch }));
}

module.exports = {
  handleSetKillSwitch
};
