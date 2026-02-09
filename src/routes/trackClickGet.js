'use strict';

const { decodeTrackToken } = require('../domain/trackToken');
const { recordClickAndRedirect } = require('../usecases/track/recordClickAndRedirect');

function decodePathToken(raw) {
  if (!raw) return null;
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch (_err) {
    return null;
  }
}

function writeError(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

async function handleTrackClickGet(req, res, token) {
  const decoded = decodePathToken(token);
  if (!decoded) {
    writeError(res, 400, 'token required');
    return;
  }

  let payload;
  try {
    payload = decodeTrackToken(decoded);
  } catch (err) {
    const msg = err && err.message ? err.message : 'invalid token';
    if (msg.includes('expired') || msg.includes('invalid')) {
      writeError(res, 403, 'forbidden');
      return;
    }
    writeError(res, 500, 'error');
    return;
  }

  try {
    const result = await recordClickAndRedirect({
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId
    });
    res.writeHead(302, { location: result.url });
    res.end();
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.includes('required') || message.includes('not found') || message.includes('WARN')) {
      writeError(res, 400, message.includes('WARN') ? 'link health WARN' : message);
      return;
    }
    writeError(res, 500, 'error');
  }
}

module.exports = {
  handleTrackClickGet
};

