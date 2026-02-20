'use strict';

const { recordClickAndRedirect } = require('../usecases/track/recordClickAndRedirect');

function isTrackPostClickEnabled() {
  const raw = process.env.TRACK_POST_CLICK_ENABLED;
  if (raw === undefined || raw === null || String(raw).trim() === '') return true; // compat default
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function resolveRequestId(req) {
  const headerId = req && req.headers && req.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.length > 0) return headerId;
  const trace = req && req.headers && req.headers['x-cloud-trace-context'];
  if (typeof trace === 'string' && trace.length > 0) return trace.split('/')[0];
  return 'unknown';
}

function logObs(action, result, fields) {
  const parts = [`[OBS] action=${action} result=${result}`];
  if (fields && fields.requestId) parts.push(`requestId=${fields.requestId}`);
  if (fields && fields.deliveryId) parts.push(`deliveryId=${fields.deliveryId}`);
  if (fields && fields.linkRegistryId) parts.push(`linkRegistryId=${fields.linkRegistryId}`);
  console.log(parts.join(' '));
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

async function handleTrackClick(req, res, body) {
  if (!isTrackPostClickEnabled()) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('forbidden');
    logObs('click_post_compat', 'reject', { requestId: resolveRequestId(req) });
    return;
  }

  const payload = parseJson(body, res);
  if (!payload) return;
  const requestId = resolveRequestId(req);
  try {
    const result = await recordClickAndRedirect({
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId,
      at: payload.at
    });
    logObs('click', 'ok', {
      requestId,
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId
    });
    res.writeHead(302, { location: result.url });
    res.end();
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.includes('required') || message.includes('not found')) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(message);
      logObs('click', 'reject', {
        requestId,
        deliveryId: payload.deliveryId,
        linkRegistryId: payload.linkRegistryId
      });
      return;
    }
    if (message.includes('WARN')) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('link health WARN');
      logObs('click', 'reject', {
        requestId,
        deliveryId: payload.deliveryId,
        linkRegistryId: payload.linkRegistryId
      });
      return;
    }
    logObs('click', 'error', {
      requestId,
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId
    });
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('error');
  }
}

module.exports = {
  handleTrackClick
};
